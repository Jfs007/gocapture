(function () {
    var KEY = "__GOCAPTURE_APP_DEV_RELOAD__";
    var state = window[KEY] || {};
    state.generation = (state.generation || 0) + 1;
    state.poll = state.poll || 1000;
    state.reloading = false;
    if (state.timer) clearTimeout(state.timer);
    window[KEY] = state;

    var generation = state.generation;

    function getMdWeb() {
        try {
            if (typeof _require !== "function") return null;
            var mdChrome = _require("mdChrome");
            return mdChrome && mdChrome.web;
        } catch (error) {
            return null;
        }
    }

    function getConfigUrl() {
        var pluginId = localStorage.getItem("MdPluginId");
        if (!pluginId) return "";
        return "chrome-extension://" + pluginId + "/app/config.json";
    }

    function schedule(delay) {
        if (state.generation !== generation) return;
        state.timer = setTimeout(tick, delay || state.poll || 1000);
    }

    function updatePoll(config) {
        var poll = config && config.dev && config.dev.reload && Number(config.dev.reload.poll);
        if (poll && poll >= 300) state.poll = poll;
    }

    function dispatch(name, detail) {
        try {
            window.dispatchEvent(new CustomEvent(name, { detail: detail }));
        } catch (error) {
        }
    }

    async function tick() {
        if (state.generation !== generation) return;
        if (state.reloading) {
            schedule();
            return;
        }

        var configUrl = getConfigUrl();
        if (!configUrl) {
            schedule(1500);
            return;
        }

        try {
            var response = await fetch(configUrl + "?t=" + Date.now(), { cache: "no-store" });
            var config = await response.json();
            var version = config && config.version;
            updatePoll(config);

            if (!state.lastVersion) {
                state.lastVersion = version;
                schedule();
                return;
            }

            if (version && version !== state.lastVersion) {
                var mdWeb = getMdWeb();
                state.lastVersion = version;
                if (mdWeb && typeof mdWeb.cmd === "function") {
                    state.reloading = true;
                    dispatch("gocapture-app:before-reload", { version: version });
                    await mdWeb.cmd({ cmd: "start", isDevConfig: 1 });
                    dispatch("gocapture-app:after-reload", { version: version });
                }
            }
        } catch (error) {
            console.warn("[app-dev-reload] poll failed", error);
        } finally {
            if (state.generation === generation) {
                state.reloading = false;
                schedule();
            }
        }
    }

    schedule(200);
})();
