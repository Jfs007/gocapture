chrome.runtime.onMessage.addListener(async (msg) => {

    if (msg.cmd == 'downFile') {
        const { filename } = msg;
        const res = await fetch(
            msg.url,
            msg.fetchOptions
        );
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({
            url,
            filename,
            conflictAction: 'overwrite',
            saveAs: false
        });
        setTimeout(() => URL.revokeObjectURL(url), 60)
    }

});

