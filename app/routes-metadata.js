// var express = require('express')
// var router = express.Router()
var get = require('lodash/get')
var set = require('lodash/get')
var flattenDeep = require('lodash/flattenDeep')
var MessageFormat = require('messageformat')
var Markdown = require('markdown').markdown.toHTML
var shortid = require('shortid')

var jsonschema = require('jsonschema');
var validator = new jsonschema.Validator();

var matchProp = require('./applib/match-prop')
var getRouteHierarchy = require('./applib/route-hierarchy')


var msgFormats = {}
msgFormats['en-GB'] = new MessageFormat('en-GB')
var defaultLocale = 'en-GB'

var i18n = require('./metadata/elements.json')

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
  // router.use(function(req, res, next){
  //   res.locals['global_header_text'] = 'Child Arrangement Action Plan'
  //   res.locals['logo_link_title'] = 'Child Arrangement Action Plan'
  //   res.locals['homepage_url'] = '/'
  //   next()
  // })

  router.use(function (req, res, next) {
    // move to final render section?
    var nunjucksEnv = res.app.locals.settings.nunjucksEnv 
    nunjucksEnv.addGlobal('req', req)
    nunjucksEnv.addGlobal('res', res)
    nunjucksEnv.addGlobal('i18n', i18n)
    next()
  })

  var rootUrl = '/'

  // var storeValues = function () {
  //   return function (req, res) {
  //     var controller = new Promise(function (resolve) {})
  //   }
  // }
  var getDefaultController = function (req, res) {
    return function () {
      return Promise.resolve()
    }
  }
  var routesConfig = require('./metadata/routes.json')
  var routes = routesConfig.routes
  var pages = routesConfig.route
  var routesFlattened = {}
  var elementRouteMapping = {}
  function flattenRoutes (routes, urlPrefix, hierarchy) {
    // hierarchy = hierarchy || []
    urlPrefix = urlPrefix.replace(/\/+$/, '')
    routes.forEach((routeName, index) => {
      var routeHierarchy = hierarchy ? hierarchy.slice() : []
      if (!routesFlattened[routeName]) {
        routesFlattened[routeName] = Object.assign({}, pages[routeName])
        var routeExtends = routesFlattened[routeName].extends
        if (routeExtends) {
          routesFlattened[routeName] = Object.assign({}, pages[routeExtends], routesFlattened[routeName])
          i18n['route.' + routeName] = Object.assign({}, i18n['route.' + routeExtends], i18n['route.' + routeName])
        }
      }
      var route = routesFlattened[routeName]
      route.hierarchy = routeHierarchy.slice()
      route.hierarchy.push(routeName)
      route.wizard = route.hierarchy[0]
      // route.selected_hierarchy = route.hierarchy.slice(1)
      routeHierarchy.push(routeName)
      route.url = route.url || routeName
      if (route.url.indexOf('/') !== 0) {
        route.url = urlPrefix + '/' + route.url
      }
      if (route.steps) {
        // console.log('REDIRECT TOP', routeName, route.steps[0])
        routesFlattened[routeName].redirect = route.steps[0]
        route.steps.forEach((step, i) => {
          routesFlattened[step] = Object.assign({}, pages[step])
          if (route.steps[i + 1]) {
            // console.log('REDIRECT STEP', step, route.steps[i + 1])
            routesFlattened[step].redirect = route.steps[i + 1]
          } else if (routes[index + 1] && hierarchy) {
            // console.log('MISSED STEP', step, routes[index + 1])
            routesFlattened[step].redirect = routes[index + 1]
          }
        })
        var routeUrlPrefix = route.url
        if (routeUrlPrefix.indexOf('/') !== 0) {
          routeUrlPrefix = urlPrefix + '/' + routeUrlPrefix
        }
        flattenRoutes(route.steps, routeUrlPrefix, routeHierarchy)
      }
    })
  }
  flattenRoutes(routes, rootUrl)

  function getRouteUrl(name, params, options) {
    options = options || {}
    var url = '/dev/null'
    if (routesFlattened[name]) {
      url = routesFlattened[name].url
    }
    if (options.edit) {
      url += '/edit'
    }
    return url
  }

  var wizardHierarchy = getRouteHierarchy(routes, pages)
  // console.log('wizardHierarchy', JSON.stringify(wizardHierarchy, null, 2))

  var routeUrls = {}
  // var blah = Object.keys(routesFlattened).sort(function(a, b){
  //   return getRouteUrl(a).localeCompare(getRouteUrl(b))
  // }).reverse()
  // console.log(blah)
  Object.keys(routesFlattened).sort(function(a, b){
    return getRouteUrl(a).localeCompare(getRouteUrl(b))
  }).reverse().forEach(routeName => {
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
      // Call controller if exists
      console.log('use routeName', routeName)
      if (!req.session.access_code) {
        req.session.access_code = shortid.generate()
      }
      if (req.url !== '/') {
        var possible_code = req.url.replace(/^\//, '')
        if (possible_code !== 'edit') {
          req.session.access_code = possible_code
        }
      }
      var access_code = req.session.access_code
      req.session.autofields = req.session.autofields || {}
      var elements = (route.elements || []).slice()
      var elements_to_validate = elements.slice()
      var elements_found = flattenDeep(elements.concat(recurseElements(elements)))
      if (req.method === 'POST') {
        var errors = {}
        elements_found.forEach(el => {
          var inboundValue = req.body[el]
          var schema = Object.assign({}, getElement(el))
          schema.type = schema.type || 'string'
          if (schema.type.match(/number|integer/)) {
            inboundValue = inboundValue ? Number(inboundValue) : undefined
          } else if (schema.type === 'radioGroup') {
            schema.type = 'string'
            var optionsEnum = schema.options.map(function(option) {
              return getElementProp(option, 'value')
            })
            schema.enum = optionsEnum
          }
          var validationError = validator.validate(inboundValue, schema).errors
          if (validationError.length) {
            errors[el] = validationError[0]
            // console.log('el', el, errors[el])
          }
        })
        if (!Object.keys(errors).length) {
          errors = undefined
        }
        elements_found.forEach(el => {
          req.session.autofields[el] = req.body[el]
        })
        // console.log('SESSION', JSON.stringify(req.session, null, 2))
      }
      // console.log('elements_found', elements_found)
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
          // if (req.method === 'POST') {
          //   elements_found.forEach(el => {
          //     req.session.autofields[el] = req.body[el]
          //   })
          //   console.log(JSON.stringify(req.session, null, 2))
          // }
          var routeInstanceFinal = Object.assign({}, routeInstance, outcome)
          var autofields = routeInstanceFinal.autofields
          function checkNoDependency(name) {
            var dependencyMet = true
            var depends = getElementProp(name, 'depends')
            if (depends) {
              dependencyMet = matchProp(autofields, depends)
            }
            return dependencyMet
          }
          req.session.visited = req.session.visited || {}
          var wizard = routeInstanceFinal.wizard
          var wizardlastRoute
          if (wizard) {
            wizardlastRoute = wizardHierarchy[wizard].lastRoute
          }
          if (wizardlastRoute === routeName) {
            routeInstanceFinal.wizardlastRoute = true
            req.session.visited[wizardlastRoute] = true
          }
          var redirectUrl = routeUrls[routeInstanceFinal.redirect] || routeInstanceFinal.redirect
          if (!errors && req.method === 'POST' && routeInstanceFinal.redirect && req.originalUrl !== routeInstanceFinal.redirect && req.body.updateForm !== 'yes') {
            req.session.visited[routeName] = true
            if (req.originalUrl.match(/\/edit$/)) {
              if (wizardlastRoute) {
                redirectUrl = getRouteUrl(wizardlastRoute)
              }
            }
            res.redirect(redirectUrl)
          } else {
            // Work out number of wizard steps, the number of the step and the wizard flow data (for flowchart generation)
            var wizardStepCount;
            var wizardStepsLength;
            if (wizardHierarchy[routeInstanceFinal.wizard]) {
              var theWiz = wizardHierarchy[routeInstanceFinal.wizard].stepsFlat.slice()
              var wizExpose = theWiz.map(step => {
                return Object.assign({ name: step }, getElement(step))
              })
              // console.log('wizExpose', JSON.stringify(wizExpose, null, 2))
              theWiz.pop()
              wizardStepsLength = theWiz.length
              wizardStepCount = theWiz.indexOf(routeName)
              if (wizardStepCount > -1) {
                wizardStepCount++
              } else {
                wizardStepCount = 0
              }
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
              args = args || Object.assign({
                wizardStepsLength: wizardStepsLength
              }, req.session.autofields, values)
              var formatted
              try {
                formatted = msgFormats[defaultLocale].compile(value)(args)
              } catch (e) {
                formatted = value + ': ' + e.message
              }
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
              return format(value, options.args).replace(/ ([^ ]+)$/, '&nbsp;$1')
            }
            function getFormattedBody (element, prop, defaultValue, options) {
              options = marshallDefaultValue(defaultValue, options)
              var value = getElementProp(element, 'body', options).trim()
              var formattedBody = format(value, options.args)
              if (options.markdown !== false) {
                formattedBody = Markdown(formattedBody)
                formattedBody = formattedBody.replace(/<ol>/g, '<ol class="list list-number">')
                formattedBody = formattedBody.replace(/<ul>/g, '<ul class="list list-bullet">')
              }
              //  | trim | replace("\n", "</p><p>"
              return formattedBody
            }
            function getError (element, options) {
              options = options || {}
              var error = options.error
              if (!error && errors) {
                error = errors[element] ? errors[element] : ''
              }
              return error
            }
            function getFormattedError (element, options) {
              options = options || {}
              var error = getError(element, options)
              var formattedError = error
              if (typeof error === 'object') {
                var errorPrefix = options.header ? 'error-header:' : 'error:'
                formattedError = getElementProp(errorPrefix + error.name)
              }
              return format(formattedError, {
                control: getElementProp(element, 'label'),
                argument: error.argument
              })
            }
            function routeVisited(route) {
              return req.session.visited[route]
            }
            var businessElements = routeInstanceFinal.elements
            if (businessElements) {
              businessElements = businessElements.filter(function(el){
                return !getElementProp(el, 'auxilliary') && checkNoDependency(el)
              })
            }
            if (!businessElements || !businessElements.length) {
              console.log(req.originalUrl, 'REDIRECT TO', redirectUrl)
              res.redirect(redirectUrl)
              return
            }
            routeInstanceFinal.values = values
            var nunjucksEnv = res.app.locals.settings.nunjucksEnv
            nunjucksEnv.addGlobal('getValue', function (name, vals) {
              if (!vals) {
                vals = values
              }
              return values[name]
            })

            nunjucksEnv.addGlobal('errors', errors)
            nunjucksEnv.addGlobal('getRouteUrl', getRouteUrl)
            nunjucksEnv.addGlobal('getElement', getElement)
            nunjucksEnv.addGlobal('getElementProp', getElementProp)
            nunjucksEnv.addGlobal('getFormatted', getFormatted)
            nunjucksEnv.addGlobal('getFormattedProp', getFormattedProp)
            nunjucksEnv.addGlobal('getFormattedBody', getFormattedBody)
            nunjucksEnv.addGlobal('getRawError', getError)
            nunjucksEnv.addGlobal('getError', getError)
            nunjucksEnv.addGlobal('getFormattedError', getFormattedError)
            nunjucksEnv.addGlobal('checkNoDependency', checkNoDependency)
            nunjucksEnv.addGlobal('routeVisited', routeVisited)
            nunjucksEnv.addGlobal('mergeObjects', function () {
              var merged = {}
              var args = Array.prototype.slice.call(arguments)
              while (args.length) {
                merged = Object.assign(merged, args.shift())
              }
              nunjucksEnv.addGlobal('macros', merged)
              return merged
            })
            setTimeout(() => {
              res.render('route', {
                route: routeInstanceFinal,
                savedfields: JSON.stringify(req.session.autofields, null, 2),
                autofields: req.session.autofields,
                wizard: wizardHierarchy[routeInstanceFinal.wizard],
                wizardStepsLength: wizardStepsLength,
                wizardStepCount: wizardStepCount,
                visited: req.session.visited,
                access_code: access_code
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
