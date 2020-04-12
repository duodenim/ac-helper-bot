# Setup

Clone the repo and run `npm install`

Create a config.json with the following fields
```
{
    "token": "discord-bot-token",
    "prefix": "$",
    "server_settings": [
        {
            "id": "server-id",
            "allowed_channel": "channel-bot-commands-are-in"
        },
        {
            "id": "server-id",
            "allowed_channel": "channel-bot-commands-are-in"
        }
    ]
}
```

To start the bot: `npm start`

# Usage 

All commands start with the prefix string from config.json:

* search [keywords] - Searches nooksisland.com for custom clothing patterns
