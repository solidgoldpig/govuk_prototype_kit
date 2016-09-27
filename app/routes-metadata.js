// var express = require('express')
// var router = express.Router()
var get = require('lodash/get')
var set = require('lodash/get')
var flattenDeep = require('lodash/flattenDeep')
var MessageFormat = require('messageformat')
var Markdown = require('markdown').markdown.toHTML

var msgFormats = {}
msgFormats['en-GB'] = new MessageFormat('en-GB')
var defaultLocale = 'en-GB'

var i18n = require('./metadata/elements.json')

function recurseElements (node) {
  var nested_elements = []
  if (!node) {
    return nested_elements
  }
  if (typeof node === 'string') {
    node = [node]
  }
  node.forEach(el => {
    var subelements = get(i18n, el + '.elements')
    var reveals = get(i18n, el + '.reveals')
    if (subelements) {
      nested_elements.push(subelements)
      nested_elements.push(recurseElements(subelements))
    } else if (reveals) {
      nested_elements.push(reveals)
      nested_elements.push(recurseElements([reveals]))
    }
    var checkbox = get(i18n, el + '.type') === 'checkboxGroup'
    if (checkbox) {
      var options = get(i18n, el + '.options')
      if (options) {
        nested_elements.push(options)
        options.forEach(opt => {
          var optReveals = get(i18n, opt + '.reveals')
          if (optReveals) {
            nested_elements.push(optReveals)
            nested_elements.push(recurseElements(optReveals))
          }
        })
      }
    }
  })
  return nested_elements
}

function initRoutes (router) {
  router.use(function (req, res, next) {
    var nunjucksEnv = res.app.locals.settings.nunjucksEnv // res.app.get('engine')
    // console.log('res.app', res.app.engines)
    // conssole.log('res.app.locals', res.app.locals)
    // console.log('req.app', req.app.engine)
    // var config = req.app.get('config')

    // engine.addGlobal('config', config)
    nunjucksEnv.addGlobal('req', req) // useless?
    nunjucksEnv.addGlobal('res', res)
    nunjucksEnv.addGlobal('i18n', i18n)
    next()
  })

  var rootUrl = '/'

  var storeValues = function () {
    return function (req, res) {
      var controller = new Promise(function (resolve) {})
    }
  }
  var getDefaultController = function (req, res) {
    return function () {
      // var controller = new Promise(function(resolve) {
      //   // var session = req.session
      //   // if (session.foo) {
      //   //   console.log('We got foo', session.foo)
      //   // } else {
      //   //   console.log('we have no foo')
      //   //   session.foo = 'bar'
      //   // }
      //   // function dumpIt(wat) {
      //   //   console.log(`req.${wat}`, JSON.stringify(req[wat], null, 2))
      //   // }
      //   // dumpIt('query')
      //   // dumpIt('params')
      //   // dumpIt('body')
      //   resolve()
      // })
      return Promise.resolve()
    // return controller
    }
  }
  var routesConfig = require('./metadata/routes.json')
  var routes = routesConfig.routes
  var pages = routesConfig.route
  var routesFlattened = {}
  var elementRouteMapping = {}
  function flattenRoutes (routes, urlPrefix) {
    urlPrefix = urlPrefix.replace(/\/+$/, '')
    routes.forEach(routeName => {
      if (!routesFlattened[routeName]) {
        routesFlattened[routeName] = Object.assign({}, pages[routeName])
        var routeExtends = routesFlattened[routeName].extends
        if (routeExtends) {
          routesFlattened[routeName] = Object.assign({}, pages[routeExtends], routesFlattened[routeName])
          i18n['route.' + routeName] = Object.assign({}, i18n['route.' + routeExtends], i18n['route.' + routeName])
        }
      }
      var route = routesFlattened[routeName]
      route.url = route.url || routeName
      if (route.url.indexOf('/') !== 0) {
        route.url = urlPrefix + '/' + route.url
      }
      if (route.steps) {
        routesFlattened[routeName].redirect = route.steps[0]
        route.steps.forEach((step, i) => {
          routesFlattened[step] = Object.assign({}, pages[step])
          if (route.steps[i + 1]) {
            routesFlattened[step].redirect = route.steps[i + 1]
          }
        })
        var routeUrlPrefix = route.url
        if (routeUrlPrefix.indexOf('/') !== 0) {
          routeUrlPrefix = urlPrefix + '/' + routeUrlPrefix
        }
        flattenRoutes(route.steps, routeUrlPrefix)
      }
    })
  }
  flattenRoutes(routes, rootUrl)

  var routeUrls = {}
  Object.keys(routesFlattened).sort().reverse().forEach(routeName => {
    var route = routesFlattened[routeName]
    console.log('Serving', routeName, '=>', route.url)
    route.name = routeName
    route.key = 'route:' + routeName
    var method = route.method || 'use'
    var url = route.url
    routeUrls[routeName] = url
    var routeController = route.controller ? require('./controllers/' + route.controller) : getDefaultController
    router[method](url, (req, res) => {
      var routeHandler = routeController(req, res)
      // Copy req.params, req.query and req.body to globals - NO - for obvious reasons
      // Call controller if exists
      console.log('use routeName', routeName)
      req.session.autofields = req.session.autofields || {}
      var elements = (route.elements || []).slice()
      var elements_to_validate = elements.slice()
      var elements_found = flattenDeep(elements.concat(recurseElements(elements)))
      console.log('elements_found', elements_found)
      var values = {}
      elements_found.forEach(el => {
        values[el] = req.session.autofields[el]
      })
      var autofields = req.session.autofields
      var routeInstance = Object.assign({}, route, {
        values: values,
        autofields: autofields
      })
      routeHandler(routeInstance)
        .then(outcome => {
          if (req.method === 'POST') {
            elements_found.forEach(el => {
              req.session.autofields[el] = req.body[el]
            })
            console.log(JSON.stringify(req.session, null, 2))
          }
          var routeInstanceFinal = Object.assign({}, route, outcome)
          if (req.method === 'POST' && routeInstanceFinal.redirect && req.originalUrl !== routeInstanceFinal.redirect) {
            res.redirect(routeUrls[routeInstanceFinal.redirect] || routeInstanceFinal.redirect)
          } else {
            routeInstanceFinal.values = values
            var nunjucksEnv = res.app.locals.settings.nunjucksEnv
            nunjucksEnv.addGlobal('getValue', function (name, vals) {
              if (!vals) {
                vals = values
              }
              return values[name]
            })
            function marshallDefaultValue (defaultValue, options) {
              if (typeof defaultValue === 'object') {
                options = defaultValue
                defaultValue = options['defaultValue']
              }
              options = options || {}
              options['defaultValue'] = defaultValue
              return options
            }
            function getElement (element, defaultValue, options) {
              options = marshallDefaultValue(defaultValue, options)
              if ((!options.valueStrict && options.value) || (options.valueStrict && options.value !== undefined)) {
                return options.value
              }
              var defaultValue = options['defaultValue']
              delete options['defaultValue']
              var path = element
              if (options.prop) {
                if (Array.isArray(options.prop)) {
                  for (var i = 0, pLength = options.prop.length; i < pLength; i++) {
                    var value = get(i18n, path + '.' + options.prop[i])
                    if ((!options.propStrict && value) || (options.propStrict && value !== undefined)) {
                      return value
                    }
                  }
                  return defaultValue
                } else {
                  path = path + '.' + options.prop
                }
              }
              var value = get(i18n, path, defaultValue)
              return value
            }
            function getElementProp (element, prop, defaultValue, options) {
              options = marshallDefaultValue(defaultValue, options)
              options.prop = prop
              return getElement(element, options)
            }
            var recurseMatch = /##([\s\S]+?)##/
            function reformat (value, args) {
              if (value.match(recurseMatch)) {
                value = value.replace(recurseMatch, function (m, m1) {
                  var keyParams = m1.trim()
                  var nestedValue = getFormattedProp(keyParams)
                  return nestedValue
                })
                value = reformat(value, args)
              }
              return value
            }
            function format (value, args) {
              if (!value) {
                return ''
              }
              if (typeof value !== 'string') {
                return value.toString()
              }
              if ((value.indexOf('{') === -1) && !value.match(recurseMatch)) {
                return value
              }
              args = args || Object.assign({}, req.session.autofields, values)
              var formatted = msgFormats[defaultLocale].compile(value)(args)
              return reformat(formatted, args)
            }
            function getFormatted (element, defaultValue, options) {
              options = marshallDefaultValue(defaultValue, options)
              var value = getElement(element, options)
              return format(value, options.args)
            }
            function getFormattedProp (element, prop, defaultValue, options) {
              options = marshallDefaultValue(defaultValue, options)
              var value = getElementProp(element, prop, options)
              return format(value, options.args)
            }
            function getFormattedBody (element, prop, defaultValue, options) {
              options = marshallDefaultValue(defaultValue, options)
              var value = getElementProp(element, 'body', options)
              var formattedBody = format(value, options.args).trim()
              if (options.markdown !== false) {
                formattedBody = Markdown(formattedBody)
                formattedBody = formattedBody.replace(/<ol>/g, '<ol class="list list-number">')
                formattedBody = formattedBody.replace(/<ul>/g, '<ol class="list list-bullet">')
              }
              return formattedBody
            }

            nunjucksEnv.addGlobal('getElement', getElement)
            nunjucksEnv.addGlobal('getElementProp', getElementProp)
            nunjucksEnv.addGlobal('getFormatted', getFormatted)
            nunjucksEnv.addGlobal('getFormattedProp', getFormattedProp)
            nunjucksEnv.addGlobal('getFormattedBody', getFormattedBody)
            nunjucksEnv.addGlobal('mergeObjects', function () {
              var merged = {}
              var args = Array.prototype.slice.call(arguments)
              while (args.length) {
                merged = Object.assign(merged, args.shift())
              }
              return merged
            })
            setTimeout(() => {
              res.render('route', {
                route: routeInstanceFinal,
                savedfields: JSON.stringify(req.session.autofields, null, 2),
                autofields: req.session.autofields
              })
            }, 0)
          }
        })
        .catch(e => {
          console.log('routes-metadata error', e)
          res.send('Something went wrong - sorry about that')
        })
    })
  })
}

module.exports = initRoutes
