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
        arrangements_duration: {
          'less_than_6_months': 1,
          '6_months_to_2_years': 2,
          'more_than_2_years': 3
        },
        relationship_status: {
          'friendly': 1,
          'unfriendly': 2,
          'agressive': 3,
          'no_contact': 3
        },
        communications_about_arrangements: {
          'very_easy': 1,
          'easy': 1,
          'tolerable': 2,
          'difficult': 3,
          'very_difficult': 3
        },
        'communication_methods_in_person': 1,
        'communication_methods_phone': 1,
        'communication_methods_online': 1,
        'communication_methods_none': 3
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
