const { app } = require("../app");
const { render } = require("../utils");

app.get("/about/", (req, res) => {
    res.send(
        render(req, "about/about.pug", {
            title: "About",
        })
    );
});
