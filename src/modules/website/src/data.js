exports.team_info = {
    mod: {
        title: "Moderation Team",
        name: "Moderator",
        description:
            "Our moderation team is responsible for upholding civility and order and maintaining a friendly and welcoming environment for everyone. " +
            "They help members that require aid as well as punish members who don't abide by the server's rules. If you are a level-headed individual " +
            "with the problem solving skills to handle problematic users and defuse conflicts, you may be a good candidate for this position. " +
            "Moderation experience is preferred.",
    },
    tcmod: {
        title: "Theorycrafting Moderation Team",
        name: "TC Mod",
        description:
            "Our theorycrafting moderation team is responsible for theorycrafting channels, keeping conversations civil and in check to maintain a safe " +
            "environment for theorycrafting. If you are a level-headed individual with the problem solving skills to handle problematic users and defuse " +
            "conflicts, and have experience and a passion for theorycrafting, you may be a good candidate for this possible. Theorycrafting and moderation " +
            "experience is preferred.",
    },
    dev: {
        title: "Dev Team",
        name: "Developer",
        description:
            "Our dev team is responsible for the @Shenhe bot and any other bots in the server, as well as the website, and keeping the server and its " +
            "assets functioning properly from the technical side. If you are experienced with Discord bots, web development, databases, or have other " +
            "technical skills, you may be a good candidate for this position. Python or JavaScript/TypeScript experience and experience with collaborative " +
            "development are preferred.",
    },
    art: {
        title: "Art Team",
        name: "Artist",
        description:
            "Our art team creates original emojis, stickers, banners, role icons, and other assets for the server / website. They also have the authority " +
            "to accept or reject emoji submissions as well as judging submissions for art-related events. If you have experience with art, editing in " +
            "Photoshop or other software, animation, or other art-related skills, you may be a good candidate for this position.",
    },
    tc: {
        title: "Theorycrafting Team",
        name: "Theorycrafter",
        description:
            "Our TC team is responsible for delving into the game's mechanics, including optimizing builds, creating team compositions, and discussing " +
            "playstyles best suited for each character in Genshin Impact. If you have experience in theorycrafting and an interest in theorizing about " +
            "builds and team compositions, you may be a good candidate for this position. Spreadsheet proficiency and Genshin Impact-specific " +
            "theorycrafting experience are preferred.",
    },
    tl: {
        title: "Translation Team",
        name: "Translator",
        description:
            "Our translation team includes members with a great comprehension in Chinese with the ability to fluently translate into English. If you " +
            "are fluent in Chinese and English, and have experience and an interest in translating Genshin Impact-related things like character " +
            "descriptions and social media posts, you may be a good candidate for this position. We prefer that you are willing to read, translate, " +
            "and interact with leaks, but it is not strictly necessary.",
    },
    event: {
        title: "Event Team",
        name: "Event Coordinator",
        description:
            "Our event team is responsible for planning and executing server events and creating fun and interactive occasions for the community. " +
            "If you have experience with designing engaging community events and organizing event details, you may be a good candidate for this position.",
    },
    media: {
        title: "Media Team",
        name: "Social Media Manager",
        description:
            "Our media team is in charge of creating posts across SHM's various social media platforms, including shouting out in-game or server-exclusive " +
            "events, or simply retweeting Shenhe related art. If you have experience with maintaining social media accounts or streaming and have ideas on " +
            "what to post and how to increase social media reach and interactions, you may be a good candidate for this position. Due to the nature of this " +
            "position, media team members must be trusted by server staff already, and this position will likely remain closed to selection by server admins.",
    },
};

exports.timezones = [
    [-720, "(GMT -12:00) Eniwetok, Kwajalein"],
    [-660, "(GMT -11:00) Midway Island, Samoa"],
    [-600, "(GMT -10:00) Hawaii"],
    [-540, "(GMT -9:00) Alaska"],
    [-480, "(GMT -8:00) Pacific Time (US &amp; Canada)"],
    [-420, "(GMT -7:00) Mountain Time (US &amp; Canada)"],
    [-360, "(GMT -6:00) Central Time (US &amp; Canada), Mexico City"],
    [-300, "(GMT -5:00) Eastern Time (US &amp; Canada), Bogota, Lima"],
    [-240, "(GMT -4:00) Atlantic Time (Canada), Caracas, La Paz"],
    [-210, "(GMT -3:30) Newfoundland"],
    [-180, "(GMT -3:00) Brazil, Buenos Aires, Georgetown"],
    [-120, "(GMT -2:00) Mid-Atlantic"],
    [-60, "(GMT -1:00) Azores, Cape Verde Islands"],
    [0, "(GMT) Western Europe Time, London, Lisbon, Casablanca"],
    [60, "(GMT +1:00) Brussels, Copenhagen, Madrid, Paris"],
    [120, "(GMT +2:00) Kaliningrad, South Africa"],
    [180, "(GMT +3:00) Baghdad, Riyadh, Moscow, St. Petersburg"],
    [210, "(GMT +3:30) Tehran"],
    [240, "(GMT +4:00) Abu Dhabi, Muscat, Baku, Tbilisi"],
    [270, "(GMT +4:30) Kabul"],
    [300, "(GMT +5:00) Ekaterinburg, Islamabad, Karachi, Tashkent"],
    [330, "(GMT +5:30) Bombay, Calcutta, Madras, New Delhi"],
    [345, "(GMT +5:45) Kathmandu"],
    [360, "(GMT +6:00) Almaty, Dhaka, Colombo"],
    [420, "(GMT +7:00) Bangkok, Hanoi, Jakarta"],
    [480, "(GMT +8:00) Beijing, Perth, Singapore, Hong Kong"],
    [540, "(GMT +9:00) Tokyo, Seoul, Osaka, Sapporo, Yakutsk"],
    [570, "(GMT +9:30) Adelaide, Darwin"],
    [600, "(GMT +10:00) Eastern Australia, Guam, Vladivostok"],
    [660, "(GMT +11:00) Magadan, Solomon Islands, New Caledonia"],
    [720, "(GMT +12:00) Auckland, Wellington, Fiji, Kamchatka"],
];

exports.fields = {
    time_dedication: {
        type: "textarea",
        title: "How much time would you be able to dedicate towards contributing to our server, and during what time of day will you be able to be active?",
        label: "Time Dedication (Feel free to provide some details)",
        maxlen: 1024,
        required: true,
    },
    motivation: {
        type: "textarea",
        title: "What made you want to apply for this staff position in Shenhe Mains?",
        label: "",
        maxlen: 1024,
        required: true,
    },
    advocate: {
        type: "textarea",
        title: "Advocate for yourself! Why should we choose you for this position?",
        label: "",
        maxlen: 1024,
        required: false,
    },
    mod_intro: {
        type: "textarea",
        title: "Introduce yourself a little; who are you, what's your personality like, what experience do you have with moderation, how long have you played Genshin Impact, etc.?",
        label: "Introduction",
        maxlen: 4096,
        required: true,
    },
    mod_strengths: {
        type: "textarea",
        title: "Do you have any particular strengths and weaknesses?",
        label: "Strengths and Weaknesses",
        maxlen: 4096,
        required: true,
    },
    mod_scenarios: {
        type: "textarea",
        title: "Describe how you would handle a fast and problematic chat. For example, describe a situation with a problematic user that is active and contributes positively but frequently makes other users feel uncomfortable, and how you might handle a situation like that.",
        label: "Feel free to come up with some scenarios and how you would address them and include any details you need.",
        maxlen: 4096,
        required: true,
    },
    tc_experience: {
        type: "textarea",
        title: "Tell us about your knowledge of theorycrafting for both Genshin Impact and other communities. Feel free to include examples of your TC work if you have any.",
        label: "",
        maxlen: 4096,
        required: true,
    },
    dev_experience: {
        type: "textarea",
        title: "Please let us know about any experience you have with development, Discord bots, website design, etc.",
        label: "",
        maxlen: 4096,
        required: true,
    },
    dev_languages: {
        type: "textarea",
        title: "What programming languages do you have experience with? List as many as you can here.",
        label: "Python, JavaScript, TypeScript, ...",
        maxlen: 1024,
        required: true,
    },
    dev_databases: {
        type: "textarea",
        title: "Do you have any experience with databases? If so, which ones?",
        label: "PostgreSQL, MySQL, MongoDB, ...",
        maxlen: 1024,
        required: false,
    },
    dev_portfolio: {
        type: "textarea",
        title: "Please link any dev projects you have done here.",
        label: "GitHub, Bitbucket, ...",
        maxlen: 1024,
        required: false,
    },
    tc_shenhe: {
        type: "textarea",
        title: "Do you own Shenhe or know her kit? How well do you know the gameplay and damage formula of Genshin Impact?",
        label: "",
        maxlen: 4096,
        required: true,
    },
    art_forms: {
        type: "textarea",
        title: "What forms of art and/or design do you specialize in?",
        label: "Digital Art, Animation, ...",
        maxlen: 1024,
        required: true,
    },
    art_uploads: {
        type: "textarea",
        title: "Please provide 2 to 5 artworks of yours (to avoid needing to place a file size restriction on you, we ask that you upload them to an image host like Imgur or service like Google Drive and include the links here). Please indicate if any of these are NSFW.",
        label: "",
        maxlen: 1024,
        required: true,
    },
    art_portfolio: {
        type: "textarea",
        title: "Please link any portfolios or social media profiles where you post art that you would like us to see. Please let us know if any of these collections might include NSFW artwork so we can have someone willing to view NSFW art to evaluate your application.",
        label: "Pixiv, Twitter, ...",
        maxlen: 1024,
        required: true,
    },
    tl_intro: {
        type: "textarea",
        title: "Please introduce yourself using Chinese.",
        label: "",
        maxlen: 4096,
        reuqired: true,
    },
    tl_chinese: {
        type: "textarea",
        title: "How well do you know Chinese and what is your relation to the language?",
        label: "",
        maxlen: 4096,
        required: true,
    },
    tl_leaks: {
        type: "radio",
        title: "Are you okay with being exposed to leaks and spoilers of Genshin Impact while translating for our server?",
        options: [
            ["yes", "Yes"],
            ["no", "No"],
        ],
        required: true,
    },
    event_experience: {
        type: "textarea",
        title: "Please let us know about any experience you have with organizing, planning, and hosting events.",
        label: "",
        maxlen: 4096,
        required: true,
    },
    event_ideas: {
        type: "textarea",
        title: "Do you have any event ideas in mind? If so, please share them.",
        label: "",
        maxlen: 4096,
        required: true,
    },
    media_profiles: {
        type: "textarea",
        title: "Please link any of your social media profiles showing examples of your posts.",
        label: "Instagram, Twitter, ...",
        maxlen: 1024,
        required: true,
    },
    media_post_ideas: {
        type: "textarea",
        title: "Do you have any ideas for any posts or events we could include on our social media platforms?",
        label: "",
        maxlen: 4096,
        required: false,
    },
    media_reach_ideas: {
        type: "textarea",
        title: "Do you have any ideas for how we could increase our social media reach and interactions?",
        label: "",
        maxlen: 4096,
        required: false,
    },
};

exports.application_fields = {
    mod: ["mod_intro", "mod_strengths", "mod_scenarios"],
    tcmod: ["mod_intro", "tc_experience", "mod_scenarios"],
    dev: ["dev_experience", "dev_languages", "dev_databases", "dev_portfolio"],
    art: ["art_forms", "art_uploads", "art_portfolio"],
    tc: ["tc_experience", "tc_shenhe"],
    tl: ["tl_intro", "tl_chinese", "tl_leaks"],
    event: ["event_experience", "event_ideas"],
    media: ["media_profiles", "media_post_ideas", "media_reach_ideas"],
};
