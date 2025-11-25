!function () {
    if (!(location.href.indexOf('localhost') > -1 || location.href.indexOf('.itaored.com') > -1)) return;
    const token = localStorage.getItem('TOKEN');
    console.log(token, 'ldd-token');
}()