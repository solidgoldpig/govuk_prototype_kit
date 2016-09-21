// var express = require('express')
// var router = express.Router()
var get = require('lodash/get')
var set = require('lodash/get')
var flattenDeep = require('lodash/flattenDeep')

var i18n = require('./metadata/elements.json')

function recurseElements(node) {
  var nested_elements = []
  if (!node) {
    return nested_elements
  }
  if (typeof node === 'string') {
    node = [node]
  }
  node.forEach(el => {
    var subelements = get(i18n, el+'.elements')
    var reveals = get(i18n, el+'.reveals')
    if (subelements) {
      nested_elements.push(subelements)
      nested_elements.push(recurseElements(subelements))
    } else if (reveals) {
      nested_elements.push(reveals)
      nested_elements.push(recurseElements([reveals]))
    }
    var checkbox = get(i18n, el+'.type') === 'checkboxGroup'
    if (checkbox) {
      var options = get(i18n, el+'.options')
      if (options) {
        nested_elements.push(options)
        options.forEach(opt => {
          var optReveals = get(i18n, opt+'.reveals')
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

function init(router) {
  router.use(function (req, res, next) {  
      var nunjucksEnv = res.app.locals.settings.nunjucksEnv //res.app.get('engine');
      // console.log('res.app', res.app.engines)
      // conssole.log('res.app.locals', res.app.locals)
      // console.log('req.app', req.app.engine)
      // var config = req.app.get('config');

      // engine.addGlobal('config', config);
      nunjucksEnv.addGlobal('req', req) // useless?
      nunjucksEnv.addGlobal('res', res)
      nunjucksEnv.addGlobal('i18n', i18n)
      next();
  })

  var rootUrl = '/'

  var storeValues = function() {
    return function(req, res){
      var controller = new Promise(function(resolve) {

      })
    }
  }
  var getDefaultController = function(req, res) {
    return function(){
      var controller = new Promise(function(resolve) {
        // var session = req.session
        // if (session.foo) {
        //   console.log('We got foo', session.foo)
        // } else {
        //   console.log('we have no foo')
        //   session.foo = 'bar'
        // }
        // function dumpIt(wat) {
        //   console.log(`req.${wat}`, JSON.stringify(req[wat], null, 2))
        // }
        // dumpIt('query')
        // dumpIt('params')
        // dumpIt('body')
        resolve()
      })
      return controller
    }
  }
  var routes = require('./metadata/routes.json')
  var routeUrls = {}
  Object.keys(routes).forEach(routeName => {
    var route = routes[routeName]
    route.name = routeName
    var method = route.method || 'use'
    var url = route.url || `${rootUrl}/${routeName}`.replace(/\/{2,}/g, '/')
    routeUrls[routeName] = url
    router[method](url, (req, res) => {
      var routeHandler = getDefaultController(req, res);
      // Copy req.params, req.query and req.body to globals - NO - for obvious reasons
      // Call controller if exists
      console.log('use routeName', routeName);
      routeHandler()
        .then(outcome => {
          req.session.autofields = req.session.autofields || {}
          var elements = (route.elements || []).slice()
          var elements_to_validate = elements.slice()
          var elements_found = flattenDeep(elements.concat(recurseElements(elements)))
          console.log('elements_found', elements_found)
          if (req.method === 'POST') {
            elements_found.forEach(el => {
              req.session.autofields[el] = req.body[el]
            })
            console.log(JSON.stringify(req.session, null, 2))
          }
          var updatedRoute = Object.assign({}, route, outcome)
          if (req.method === 'POST' && updatedRoute.redirect && req.originalUrl !== updatedRoute.redirect) {
            res.redirect(routeUrls[updatedRoute.redirect] || updatedRoute.redirect)
          } else {
            var values = {}
            elements_found.forEach(el => {
              values[el] = req.session.autofields[el]
            })
            res.render('route', {
              route: updatedRoute,
              elements: updatedRoute.elements || [],
              values: values,
              savedfields: JSON.stringify(req.session.autofields, null, 2),
              autofields: req.session.autofields
            })
          }
        })
        .catch(e => {
          res.send('TOTES ERRORZ!')
        })

    })
  })
}

module.exports = init