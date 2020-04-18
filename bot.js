const jsdom = require('jsdom');
const fetch = require('node-fetch');
const fs = require('fs');
const Discord = require('discord.js');
const config = require('./config.json');
const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const {JSDOM} = jsdom;
const { open } = sqlite;
const client = new Discord.Client();

const base_url = 'https://nooksisland.com';
const design_url = base_url + '/designs?search=';
const token = config.token;
const prefix = config.prefix;
const server_settings = config.server_settings;

const cache_imgs = true;

let database = undefined;
let commands_in_progress = new Map();

async function searchPattern(query) {
    const response = await fetch(design_url + query);
    const html = await response.text();
    const dom = new JSDOM(html);

    //Todo - Find a better way to select these. There's no API, just server-side rendered HTML
    const imgs = dom.window.document.querySelectorAll('img');
    const patterns = Array.from(imgs).filter((pattern) => {
        return pattern.getAttribute('src').includes('designs');
    });


    let img_urls = patterns.map((pattern) => {
        const src = pattern.getAttribute('src');
        return (base_url + src);
    });
    if (cache_imgs) {
        let promises = img_urls.map((url) => {
            const local_path = url.split('/').pop();
            const file = fs.createWriteStream(local_path);
            return fetch(url).then((file_res) => { 
                file_res.body.pipe(file);
            });
        });
        await Promise.all(promises);
    }
    
    
    return img_urls;
}

function isAllowed(msg) {
    if (msg.guild == undefined) {
        return true;
    } else {
        let channel = server_settings.find((server) => {
            let channel_match = ( server.allowed_channel == msg.channel.id );
            let server_match = ( server.id == msg.guild.id );
            return (channel_match && server_match);
        });
        return (channel != undefined)
    }
}

function checkConfig() {
    let failed = false;
    if (token == undefined) {
        console.error("Missing token field inside config.json! Set this to the Discord bot token");
        failed = true;
    }

    if (prefix == undefined) {
        console.error("Missing prefix field inside config.json! Set this to the prefix to use for bot commands (!, $, #, etc.)")
        failed = true;
    }

    if (server_settings == undefined) {
        console.error("Missing server_settings field inside config.json! Set this to an array of { id, allowed_channel } pairs for the allowed server and channel IDs this bot can communicate in.");
        failed = true;
    }

    return !failed;
}

async function initDB(db) {
    await db.exec('CREATE TABLE users (user_id TINYTEXT, player_name TINYTEXT, island_name TINYTEXT, code TINYTEXT)');
    const result = await db.get('SELECT * FROM users');
}

async function newUserPrompts(message) {
    const user = message.author;
    const user_id = message.author.id.toString();

    //Database not initialized yet, do nothing
    if (database == undefined) {
        return;
    }

    const curr_user_data = await database.get('SELECT * FROM users WHERE user_id = (:id)', {
        ':id': user_id
    });
    if (curr_user_data == undefined) {
        await database.run('INSERT INTO users(user_id) VALUES (:id)', {
            ':id': user_id
        });
        commands_in_progress.set(user.id, 'newuser');
        user.send('What is your character\'s name?');
    } else if (curr_user_data.player_name == null) {
        const name = message.content;
        console.log(name);
        await database.run('UPDATE users SET player_name = (:name) WHERE user_id = (:id)', {
            ':name': name,
            ':id': user_id
        });
        user.send('What is your island name?');
    } else if (curr_user_data.island_name == null) {
        const name = message.content;
        console.log(name);
        await database.run('UPDATE users SET island_name = (:name) WHERE user_id = (:id)', {
            ':name': name,
            ':id': user_id
        });
        user.send(`Great, ${curr_user_data.player_name}! You\'re all set up! Use ${prefix}open DODO_CODE to open your island`);
        commands_in_progress.delete(user.id);
    } else {
        user.send("You're already set up!");
    }
}

client.on('ready', () => {
    console.log('Logged in');
});

client.on('message', (msg) => {
    if (isAllowed(msg)) {
        const command = (msg.content.startsWith(`${prefix}`)) ? msg.content.split(' ')[0].replace(`${prefix}`, '') : commands_in_progress.get(msg.author.id);
        let params = msg.content.split(' ');
        params.shift();
        switch(command) {
            case 'search': {
                if (params.length > 0) {
                    let search_txt = params.join('+');
                    searchPattern(search_txt).then( (urls) => {
                        if (urls.length > 0) {
                            msg.channel.send({files: urls}).catch(console.error);
                        } else {
                            msg.channel.send(`No matches for ${params.join(' ')} :(`);
                        } 
                    });
                } else {
                    msg.channel.send(`Usage: ${prefix}search keyword`);
                }
                break;
            }
            case 'newuser': {
                newUserPrompts(msg);
                break;
            }
            case 'open': {
                if ( params.length == 1 ) {
                    const code = params[0];
                    const user_id = msg.author.id.toString();
                    database.get('SELECT * FROM users WHERE user_id = ?', user_id).then((user_data) => {
                        if (user_data == undefined) {
                            msg.author.send(`Please set up your island with ${prefix}newuser first!`);
                        } else {
                            console.log(user_data);
                            msg.channel.send(`${user_data.player_name}\'s Island (${user_data.island_name}) is open at ${code}`);
                            database.run('UPDATE users SET code = (:code) WHERE user_id = (:id)', {
                                ':code': code,
                                ':id': user_data.user_id
                            });
                        }
                    });
                    
                } else {
                    msg.channel.send(`Usage: ${prefix}post DODO_CODE`);
                }
                break;
            }
            case 'close': {
                const user_id = msg.author.id.toString();
                database.get('SELECT * FROM users WHERE user_id = ?', user_id).then((user_data) =>{
                    if (user_data == undefined) {
                        msg.author.send(`Please set up your island with ${prefix}newuser first!`);
                    } else {
                        if (user_data.code) {
                            msg.channel.send(`Closed ${user_data.player_name}\'s Island`);
                            database.run("UPDATE users SET code = '' WHERE user_id = ?", user_id);
                        }
                    }
                });
                break;
            }
            case 'islands': {
                database.all("SELECT * FROM users WHERE (code IS NOT NULL AND code != '')").then((users) => {
                    console.log(users);
                    if (users.length > 0) {
                        let txt = 'The following islands are open:\n';
                        users.forEach((user) => {
                            txt += `${user.player_name}\'s Island: ${user.island_name} at ${user.code}\n`;
                        });
                        msg.channel.send(txt);
                    } else {
                        msg.channel.send('No islands are open :(');
                    }
                });
                break;
            }
        }
    }
});

if (checkConfig()) {
    open({ 
        filename: 'database.db',
        //filename: ':memory:',
        driver: sqlite3.Database
    }).then((db) => {
        console.log(db);
        initDB(db).then(() => {
            console.log('database initialized');
            database = db;
        });
    });
    client.login(token);
} else {
    process.exit(0);
}

