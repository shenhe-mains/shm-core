const { app } = require("../app");
const { render } = require("../utils");

let clicks = 0;

app.get("/nsfw/", (req, res) => {
    console.log(`${++clicks} horny disciple(s) got jebaited!`);
    res.send(
        render(req, "nsfw/index.pug", {
            title: "NSFW Access",
        })
    );
});
