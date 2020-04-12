# Required packages:
* jsdom
* node-fetch
* discord.js

# Setup

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

# Usage 

All commands start with the prefix string from config.json:

* search [keywords] - Searches nooksisland.com for custom clothing patterns
