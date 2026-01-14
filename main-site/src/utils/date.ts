/**
 * 格式日期时间
 * */
export function formatDate(time: any, b = 'yyyy-MM-dd') {
  if (!arguments.length || !time) {
    return ''
  }
  let date
  if (typeof time === 'object') {
    date = time
  } else {
    if (typeof time === 'string') {
      if (/^\d+$/.test(time)) {
        time = parseInt(time)
      } else {
        time = time.replace(/\-/gi, '/')
      }
    }
    if (typeof time === 'number' && time.toString().length === 10) {
      time = time * 1000
    }
    date = new Date(time)
  }
  const c: Record<string, unknown> = {
    'M+': date.getMonth() + 1,
    'd+': date.getDate(),
    'h+': date.getHours(),
    'm+': date.getMinutes(),
    's+': date.getSeconds(),
    'q+': Math.floor((date.getMonth() + 3) / 3)
  }
  if (/(y+)/.test(b)) {
    b = b.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length))
  }
  for (const a in c) {
    if (new RegExp('(' + a + ')').test(b)) {
      b = b.replace(RegExp.$1, RegExp.$1.length === 1 ? String(c[a]) : ('00' + c[a]).substr(('' + c[a]).length))
    }
  }
  return b
}