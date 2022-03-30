const { app } = require("../app");
const { render } = require("../utils");

app.get("/nsfw/", (req, res) => {
    res.send(
        render(req, "nsfw/index.pug", {
            title: "NSFW Access",
        })
    );
});
