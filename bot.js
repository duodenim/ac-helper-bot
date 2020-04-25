const jsdom = require('jsdom');
const fetch = require('node-fetch');
const fs = require('fs');
const Discord = require('discord.js');
const config = require('./config.json');
const DB = require('./db');
const { JSDOM } = jsdom;
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

async function newUserPrompts(message) {
    const user = message.author;
    const user_id = message.author.id.toString();

    //Database not initialized yet, do nothing
    if (database == undefined) {
        return;
    }

    const curr_user_data = await DB.get_user(database, user_id);
    console.log(curr_user_data);
    if (curr_user_data == undefined) {
        await DB.new_user(database, user_id);
        commands_in_progress.set(user.id, 'newuser');
        user.send('What is your character\'s name?');
    } else if (curr_user_data.player_name == null) {
        const name = message.content;
        console.log(name);
        DB.set_player_name(database, user_id, name);
        user.send('What is your island name?');
    } else if (curr_user_data.island_name == null) {
        const name = message.content;
        await DB.set_island_name(database, user_id, name);
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
                    DB.get_user(database, user_id).then((user_data) => {
                        if (user_data == undefined) {
                            msg.author.send(`Please set up your island with ${prefix}newuser first!`);
                        } else {
                            console.log(user_data);
                            msg.channel.send(`${user_data.player_name}\'s Island (${user_data.island_name}) is open at ${code}`);
                            DB.post_code(database, user_data.user_id, code);
                        }
                    });
                    
                } else {
                    msg.channel.send(`Usage: ${prefix}post DODO_CODE`);
                }
                break;
            }
            case 'close': {
                const user_id = msg.author.id.toString();
                DB.get_user(database, user_id).then((user_data) =>{
                    if (user_data == undefined) {
                        msg.author.send(`Please set up your island with ${prefix}newuser first!`);
                    } else {
                        if (user_data.code) {
                            msg.channel.send(`Closed ${user_data.player_name}\'s Island`);
                            DB.close_island(database, user_id);
                        }
                    }
                });
                break;
            }
            case 'islands': {
                DB.get_open_islands(database).then((users) => {
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
    DB.init_database("database.db").then((db) => {
            database = db;
    });
    client.login(token);
} else {
    process.exit(0);
}

