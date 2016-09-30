function routeHierarchy (routes, pages) {
  function recurseHierachy (routes) {
    var hierarchy = []
    routes.forEach(routeName => {
      var stepHierarchy = {
        route: routeName
      }
      if (pages[routeName] && pages[routeName].steps) {
        var steps = pages[routeName].steps.slice()
        stepHierarchy.steps = recurseHierachy(steps)
      }
      hierarchy.push(stepHierarchy)
    })
    return hierarchy
  }
  var hierarchy = recurseHierachy(routes)
  var hierarchyStructure = {}
  hierarchy.forEach(wizard => {
    hierarchyStructure[wizard.route] = wizard.steps
    if (hierarchyStructure[wizard.route]) {
      var flatSteps = []
      function flattenSteps(steps) {
        steps = steps || []
        steps.forEach(function(step) {
          flatSteps.push(step.route)
          if (step.steps) {
            flattenSteps(step.steps)
          }
        })
      }
      flattenSteps(hierarchyStructure[wizard.route])
      if (flatSteps.length) {
        hierarchyStructure[wizard.route].stepsFlat = flatSteps
        hierarchyStructure[wizard.route].lastRoute = flatSteps[flatSteps.length - 1]
      }

      console.log(hierarchyStructure[wizard.route].lastRoute)
    }
  })
  return hierarchyStructure
}

module.exports = routeHierarchy
