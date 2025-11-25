!function () {
    if (location.href.indexOf('localhost') < 0 || location.href.indexOf('.itaored.com') < 0) return;
    const token = localStorage.getItem('TOKEN');
    console.log(token, 'ldd-token');
}()