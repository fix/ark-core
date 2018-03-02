exports.up = (knex, Promise) => {
  return knex.schema.createTable('rounds', table => {
    table.increments()
    table.string('publicKey', 66).references('publicKey').inTable('wallets').index()
    table.bigInteger('balance')
    table.bigInteger('round').index()

    table.unique(['publicKey', 'round'])
  })
}

exports.down = (knex, Promise) => knex.schema.dropTableIfExists('rounds')
