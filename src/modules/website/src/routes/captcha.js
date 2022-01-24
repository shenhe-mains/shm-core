const { app } = require("../app");
const { keys, verify } = require("../../../../core/verification");
const data = require("../../../../../data");
const { render } = require("../utils");
const { default: fetch } = require("node-fetch");

app.param("captchakey", (req, res, next, id) => {
    if (keys.hasOwnProperty(id)) {
        req.captchakey = id;
    }
    next();
});

app.get("/captcha/:captchakey", (req, res) => {
    res.send(
        req.captchakey
            ? render(req, "captcha.pug", {
                  key: req.captchakey,
                  sitekey: data.captcha_site_key,
              })
            : render(req, "captcha-no-key.pug")
    );
});

app.post("/captcha/:captchakey", (req, res, next) => {
    if (req.captchakey === undefined) {
        res.send(render(req, "captcha-no-key.pug"));
        next();
    }

    const params = new URLSearchParams();
    params.append("secret", data.captcha_secret_key);
    params.append("response", req.body["g-recaptcha-response"]);

    fetch("https://google.com/recaptcha/api/siteverify", {
        method: "post",
        body: params,
    })
        .then((res) => res.json())
        .then((response) => {
            if (response.success) {
                verify(req.captchakey);
                res.send(render(req, "captcha-success.pug"));
            } else {
                res.send(
                    render(req, "captcha.pug", {
                        key: req.captchakey,
                        sitekey: data.captcha_site_key,
                        captcha_failed: true,
                    })
                );
            }
        });
});
