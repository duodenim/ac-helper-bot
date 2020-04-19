use serenity::{
    client::Client,
    model::channel::Message,
    model::gateway::Ready,
    prelude::*
};

struct Handler;

impl EventHandler for Handler {
    fn ready(&self, _: Context, _: Ready) {
        println!("Logged In!");
    }

    fn message(&self, ctx: Context, message: Message) {
        if message.content == "!ping" {
            message.channel_id.say(&ctx.http, "pong").unwrap();
        }   
    }
}

fn main() {
    //Get config data
    let config = json::parse(include_str!("../config.json")).unwrap();
    let token = config["token"].as_str().unwrap();

    //Create and start the bot
    let mut client = Client::new(token, Handler).unwrap();
    client.start().unwrap();
}
