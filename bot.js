const jsdom = require('jsdom');
const fetch = require('node-fetch');
const fs = require('fs');
const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');
const {JSDOM} = jsdom;

const base_url = 'https://nooksisland.com';
const design_url = base_url + '/designs?search=';
const token = config.token;
const prefix = config.prefix;
const server_settings = config.server_settings;

const cache_imgs = true;

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

client.on('ready', () => {
    console.log('Logged in');
});

client.on('message', (msg) => {
    if (isAllowed(msg) && msg.content.startsWith(`${prefix}search`)) {
        let search_words = msg.content.split(' ');
        if (search_words.length > 1) {
            search_words.shift();
            let search_txt = search_words.join('+');
            searchPattern(search_txt).then( (urls) => {
                if (urls.length > 0) {
                    msg.channel.send({files: urls}).catch(console.error);
                } else {
                    msg.channel.send(`No matches for ${search_words.join(' ')} :(`);
                } 
            });
        } else {
            msg.channel.send(`Usage: ${prefix}search keyword`);
        }
    }
});

if (checkConfig()) {
    client.login(token);
} else {
    process.exit(0);
}

