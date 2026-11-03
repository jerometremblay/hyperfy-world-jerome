
app.add(app.create('prim', {
  type: 'box', color: '#6ac4dc', opacity: 0.15,
  doubleside: true, castShadow: false, receiveShadow: false,
}))
for (let axis = 0; axis < 3; axis++) {
  for (const a of [-0.5, 0.5]) for (const b of [-0.5, 0.5]) {
    const size = [0.006, 0.006, 0.006]
    const position = [0, 0, 0]
    size[axis] = 1
    position[(axis + 1) % 3] = a
    position[(axis + 2) % 3] = b
    app.add(app.create('prim', {
      type: 'box', size, position, color: '#6ac4dc',
      castShadow: false, receiveShadow: false,
    }))
  }
}
