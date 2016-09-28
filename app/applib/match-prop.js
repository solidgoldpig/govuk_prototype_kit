var get = require('lodash/get')

function matchProp (obj, matchArray) {
  if (!Array.isArray(matchArray)) {
    matchArray = [matchArray]
  }
  for (var i = 0, dLength = matchArray.length; i < dLength; i++) {
    var matchStatus = true
    var checkDependency = matchArray[i]
    Object.keys(checkDependency).forEach(key => {
      var matchInverse
      var matchString = checkDependency[key]
      if (key.indexOf('!') === 0) {
        matchInverse = true
        key = key.replace(/!\s*/, '')
      }
      var matchedKeys = matchKeys(obj, key)
      if (!matchedKeys.length) {
        matchedKeys = [key]
      }
      var matched
      for (var j = 0, mkLength = matchedKeys.length; j < mkLength; j++) {
        matched = matchKeyValue(matchString, matchedKeys[j], obj)
        if (matched) {
          break
        }
      }
      if (matchInverse) {
        matched = !matched
      }
      if (!matched) {
        matchStatus = false
      }
    })
    if (matchStatus) {
      return true
    }
  }
  return false
}

function matchKeyValue (matchString, key, obj) {
  var matched
  var keyValue = get(obj, key)
  keyValue = keyValue !== undefined ? keyValue.toString() : keyValue
  if (typeof keyValue === 'string') {
    if (matchString.indexOf('<') === 0 || matchString.indexOf('>') === 0) {
      var numberComparisonMatch = matchString.match(/^(([<>]={0,1})\s*(\d+(\.\d+){0,1}))\s*(,\s*([<>]={0,1})\s*(\d+(\.\d+){0,1})){0,1}$/)
      function compareNumber (a, comp, b) {
        a = Number(a)
        b = Number(b)
        if (comp === '<') {
          return a < b
        } else if (comp === '>') {
          return a > b
        } else if (comp === '<=') {
          return a <= b
        } else if (comp === '>=') {
          return a >= b
        }
      }
      matched = compareNumber(keyValue, numberComparisonMatch[2], numberComparisonMatch[3])
      if (matched && numberComparisonMatch[7]) {
        matched = compareNumber(keyValue, numberComparisonMatch[6], numberComparisonMatch[7])
      }
    } else {
      var matcher = new RegExp('^' + matchString + '$')
      matched = keyValue.match(matcher)
    }
  } else if (typeof keyValue === 'string') {
  }
  return matched
}

function generateObjKeys (obj, prefix) {
  prefix = prefix || ''
  var keys = []
  for (var key in obj) {
    keys.push(prefix + key)
    var prop = obj[key]
    if (typeof prop === 'object' && !Array.isArray(prop)) {
      keys = keys.concat(generateObjKeys(prop, prefix + key + '.'))
    }
  }
  return keys
}

function matchKeys (obj, matchStr) {
  var keys = generateObjKeys(obj)
  var matchExp = new RegExp('^' + matchStr + '$')
  return keys.filter(function (key) {
    return key.match(matchExp) ? true : false
  })
}

module.exports = matchProp
