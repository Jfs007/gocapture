!function () {
    const NaiveUi = _require('NaiveUi');
    const Vue3 = _require('Vue3');;
    const { h } = Vue3;
    const __NProvider = ({ props, slots }) => ({
        id: 'NProvider' + Date.now(),
        setup() {
            return () => h(NaiveUi.NConfigProvider, {
                themeOverrides: {
                    common: {
                        primaryColor: '#42a6b1'
                    },

                    Select: {
                        primaryColor: '#42a6b1',
                    },
                    Button: {
                        primaryColor: '#42a6b1',
                        colorPrimary: '#42a6b1',
                        textColor: '#42a6b1'
                    },
                    Dialog: {
                        iconColorInfo: '#42a6b1',
                    }
                }
            }, {
                default: () => h(NaiveUi.NDialogProvider, null, {
                    default: () => h(NaiveUi.NMessageProvider, null, {
                        default: slots.default
                    })
                })
            })
        }
    });

    const App = ({ props, slots, options }) => {
        const { tag, id, style } = options || {};
        const div = document.createElement(tag || 'span');
        div.id = id || 'chrome-app';
        div.style = style || '';
        const app = Vue3.createApp((__NProvider({
            slots,
            props
        })));
        app.use(NaiveUi);
        app.mount(div);
        app.__el__ = div;
        return app;
    };


    _exports.module['MdUiComponent'] = {
        App,
    }



}()