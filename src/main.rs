use serenity::{
    client::Client,
    framework::standard::{StandardFramework, CommandResult, macros::{group, command}},
    model::channel::Message,
    prelude::*
};

use scraper::{Html, Selector};

use std::fs::File;
use std::io::prelude::*;

struct Handler;

impl EventHandler for Handler {}

const BASE_URL: &str = "https://nooksisland.com";
const DESIGN_URL: &str = "https://nooksisland.com/designs?search=";

#[command]
fn search(ctx: &mut Context, msg: &Message) -> CommandResult {
    //Get and validate search params
    let mut params: Vec<&str> = msg.content.split(" ").collect();

    if params.len() == 1 {
        msg.channel_id.say(&ctx.http, "Usage: search keyword")?;
        return Ok(())
    }
    params.remove(0);
    let search_txt = DESIGN_URL.to_string() + &params.join("+");

    //Search nooksisland for designs
    //There's no API, just server-side rendered HTML, so manually scrape
    //for images
    let resp = reqwest::blocking::get(&search_txt)?.text()?;
    let document = Html::parse_document(&resp);
    let img_selector = Selector::parse("img").unwrap();

    let imgs = document.select(&img_selector).filter(|img| {
        let attr = img.value().attr("src");

        match attr {
            Some(src) => {
                return src.contains("designs");
            },
            None => {
                return false;
            }
        }
    });
    let paths = imgs.map(|img| {
        let url = img.value().attr("src").unwrap();
        let local_path = url.clone().split("/").last().unwrap();
        let srv_path = format!("{}{}", BASE_URL, url);
        (local_path, srv_path)
    });

    let mut local_paths = Vec::new();
    for (local_path, src_path) in paths {
        let mut file = File::create(local_path).unwrap();
        let img_resp = reqwest::blocking::get(&src_path)?;
        file.write_all(&img_resp.bytes().unwrap()).unwrap();
        local_paths.push(local_path);
    }

    if local_paths.len() == 0 {
        msg.channel_id.say(&ctx.http, "No results were found :(")?;
    } else {
        msg.channel_id.send_files(&ctx.http, local_paths, |m| { m })?;
    }
    

    Ok(())
}

#[group]
#[commands(search)]
struct Search;

fn main() {
    //Get config data
    let config = json::parse(include_str!("../config.json")).unwrap();
    let token = config["token"].as_str().unwrap();
    let prefix = config["prefix"].as_str().unwrap().to_string();

    //Create and start the bot
    let mut client = Client::new(token, Handler).unwrap();
    client.with_framework(StandardFramework::new().configure(|c| {
        c.prefix(&prefix)
    }).group(&SEARCH_GROUP));
    client.start().unwrap();
}
