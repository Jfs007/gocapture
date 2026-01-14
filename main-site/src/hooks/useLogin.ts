import { computed, ref } from "vue"
import type { UserInfo } from '../types/chromeRedux'
const userInfo = ref<UserInfo>({})
const isLoggedIn = ref(false)

export function useLogin() {
    const login = (info: UserInfo) => {
        userInfo.value = info
        isLoggedIn.value = true
    }

    const logOut = () => {
        userInfo.value = {}
        isLoggedIn.value = false
        localStorage.removeItem('TOKEN')
   
    }

    const isLogin = computed(() => {
        return userInfo.value.token;
    })

    return {
        login,
        logOut,
        userInfo,
        isLogin
    }
}

export { userInfo }