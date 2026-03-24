// Auth helper functions

/**
 * Get token from localStorage
 */
function getToken() {
    return localStorage.getItem('token');
}

/**
 * Get user data from localStorage
 */
function getUserData() {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
}

/**
 * Check if user is authenticated
 */
async function checkAuth(requireAdmin = false) {
    const token = getToken();
    const user = getUserData();

    if (!token || !user) {
        window.location.href = '/login.html';
        return false;
    }

    // Verificar se token ainda é válido
    try {
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // Token inválido ou expirado
            logout();
            return false;
        }

        const data = await response.json();

        // Atualizar dados do usuário
        localStorage.setItem('user', JSON.stringify(data.user));

        // Verificar se precisa resetar senha
        if (data.user.must_reset_password && window.location.pathname !== '/reset-password.html') {
            window.location.href = '/reset-password.html';
            return false;
        }

        // Verificar se requer admin
        if (requireAdmin && data.user.role !== 'admin') {
            window.location.href = '/agents.html';
            return false;
        }

        return true;
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        logout();
        return false;
    }
}

/**
 * Logout user
 */
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

/**
 * Make authenticated API request
 */
async function apiRequest(url, options = {}) {
    const token = getToken();

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    try {
        const response = await fetch(url, mergedOptions);
        const data = await response.json();

        if (!response.ok) {
            // Se token inválido, fazer logout
            if (response.status === 401) {
                logout();
            }
            throw new Error(data.error || 'Erro na requisição');
        }

        return data;
    } catch (error) {
        throw error;
    }
}
