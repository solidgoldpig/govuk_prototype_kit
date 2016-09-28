var matchProp = require('../applib/match-prop')

var yourPlanController = function (req, res) {
  return function (routeInstance) {
    var controller = new Promise(function (resolve) {
      var autofields = routeInstance.autofields

      var relationship_status = 0
      function setRelationshipStatus (newValue, value) {
        return !value || (newValue > value) ? newValue : value
      }
      var weightings = {
        arrangements_how_long: {
          'less_than_6_months': 1,
          '6_months_to_2_years': 2,
          'more_than_2_years': 3
        },
        relationship_status: {
          'comfortable': 1,
          'awkward': 2,
          'stressful': 2,
          'hostile': 3,
          'no_contact': 3
        },
        communicating_about_arrangements_status: {
          'very_easy': 1,
          'easy': 1,
          'so_so': 2,
          'difficult': 3,
          'very_difficult': 3
        },
        'communicating_methods_in_person': 1,
        'communicating_methods_phone': 1,
        'communicating_methods_online': 1,
        'communicating_methods_none': 3
      }

      Object.keys(weightings).forEach(function (question) {
        var newValue = typeof weightings[question] === 'object' ? weightings[question][autofields[question]] : (autofields[question] ? weightings[question] : undefined)
        relationship_status = setRelationshipStatus(newValue, relationship_status)
      })

      var relationship_statuses = {
        '1': 'green',
        '2': 'amber',
        '3': 'red'
      }
      autofields.status_level = relationship_statuses[relationship_status]

      resolve(routeInstance)
    })
    return controller
  }
}

module.exports = yourPlanController
