var yourPlanController = function (req, res) {
  return function (routeInstance) {
    var controller = new Promise(function (resolve) {
      var autofields = routeInstance.autofields
      var elements = []
      var no_answer = []
      function setAnswer (question, values) {
        values = typeof values ? values : [values]
        var set_answer
        values.forEach(function (val) {
          if (autofields[question] === val) {
            set_answer = true
          }
        })
        if (set_answer) {
          elements.push('answer:' + question)
        } else {
          no_answer.push('noanswer:' + question)
        }
      }
      setAnswer('child_safety', ['yes', 'unsure'])
      setAnswer('parent_safety', ['yes', 'unsure'])
      setAnswer('child_flight', ['yes', 'unsure'])
      if (!autofields.tried_child_contact_centre) {
        if (autofields.children_resident === 'applicant' || autofields.children_resident === 'respondent') {
          setAnswer('children_access_disagreements', ['yes'])
          console.log('NACC SET')
        }
      }
      setAnswer('children_have_a_say', ['yes', 'unsure'])
      setAnswer('children_additional_support', ['yes', 'unsure'])

      var relationship_status = 0
      function setRelationshipStatus (newValue, value) {
        return !value || (newValue > value) ? newValue : value
      }

      var relationship_statuses = {
        '1': 'green',
        '2': 'amber',
        '3': 'red'
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
        'communicating_methods_online': 2,
        'communicating_methods_none': 3
      }

      Object.keys(weightings).forEach(function (question) {
        console.log('question', question)
        console.log('autofields[question]', autofields[question])
        var newValue = typeof weightings[question] === 'object' ? weightings[question][autofields[question]] : (autofields[question] ? weightings[question] : undefined)
        relationship_status = setRelationshipStatus(newValue, relationship_status)
      })

      if (relationship_status === 1) {
        elements.push('answer:mediation')
        elements.push('answer:odr')
      }
      if (relationship_status > 1) {
        if (!autofields.tried_spip) {
          elements.push('answer:spip')
        }
        elements.push('answer:counselling')
      }
      if (relationship_status === 2) {
        elements.push('answer:odr')
        if (autofields.tried_mediation) {
          elements.push('answer:lawyer_mediation')
        }
      }
      if (relationship_status === 3) {
      }

      if (autofields.parent_official_org_engagement === 'yes' || autofields.tried_written_agreement) {
        elements.push('answer:parental_involvement')
      }
      if (!autofields.tried_written_agreement) {
        elements.push('answer:written_agreement')
      }
      if (autofields.childcare_disagreements === 'yes') {
        elements.push('answer:legal_disagreements')
      }
      if (autofields.parental_rights_info === 'yes') {
        elements.push('answer:legal_info')
      }
      if (autofields.language_support === 'yes') {
        elements.push('answer:language_support')
      }
      routeInstance.elements = elements
      resolve(routeInstance)
    })
    return controller
  }
}

module.exports = yourPlanController
