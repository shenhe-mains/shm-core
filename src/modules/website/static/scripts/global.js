$(document).ready(function () {
    for (var element of document.querySelectorAll(".flash")) {
        console.log(element);
        var category = element.getAttribute("data-category");
        M.toast({
            html: element.innerHTML,
            classes:
                category == "ERROR"
                    ? "red"
                    : category == "SUCCESS"
                    ? "green"
                    : "grey",
        });
    }
});
