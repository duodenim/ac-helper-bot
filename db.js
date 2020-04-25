const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');

async function init_database(filename = ':memory:') {
    let db = await sqlite.open({
        filename,
        driver: sqlite3.Database
    });

    //Create a new users table if necessary
    await db.exec(`CREATE TABLE IF NOT EXISTS users (user_id TINYTEXT, player_name TINYTEXT, island_name TINYTEXT, code TINYTEXT)`);

    return db;
}

async function get_user(database, user_id) {
    return await database.get('SELECT * FROM users WHERE user_id = (:id)', {
        ':id': user_id
    });
}

async function get_open_islands(database) {
    return await database.all("SELECT * FROM users WHERE (code IS NOT NULL AND code != '')");
}

async function new_user(database, user_id) {
    await database.run('INSERT INTO users(user_id) VALUES (:id)', {
        ':id': user_id
    });
}

async function set_island_name(database, user_id, island_name) {
    await database.run('UPDATE users SET island_name = (:name) WHERE user_id = (:id)', {
        ':name': island_name,
        ':id': user_id
    });
}

async function post_code(database, user_id, code) {
    await database.run('UPDATE users SET code = (:code) WHERE user_id = (:id)', {
        ':code': code,
        ':id': user_id
    });
}

async function close_island(database, user_id) {
    await database.run("UPDATE users SET code = '' WHERE user_id = ?", user_id);
}

async function set_player_name(database, user_id, player_name) {
    await database.run('UPDATE users SET player_name = (:name) WHERE user_id = (:id)', {
        ':name': player_name,
        ':id': user_id
    });
}

module.exports = {
    close_island,
    init_database,
    get_open_islands,
    get_user,
    new_user,
    post_code,
    set_island_name,
    set_player_name
};
