var yourPlanController = function(req, res) {
  return function(){
    var controller = new Promise(function(resolve) {
      console.log('this is the yourPlan controller')
      var newRoute = {
        elements: [
          "children_number",
          "childcare_disagreements"
        ]
      }
      resolve(newRoute)
    })
    return controller
  }
}

module.exports = yourPlanController
