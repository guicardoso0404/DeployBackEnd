// 🦟👀
// Configurações da API
const API_BASE_URL = 'https://deploy-back-end-chi.vercel.app/api';
const PUSHER_KEY = 'bcaf21fe53fdcdcdc587';
const PUSHER_CLUSTER = 'sa1';

let currentUser = null;
let pusher = null;
let activeChannel = null;
let activeConversationId = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('💬 Chat carregando...');
    
    // Verificar se usuário está logado
    currentUser = getCurrentUser();
    
    if (currentUser) {
        console.log('✅ Usuário logado detectado:', currentUser.nome, currentUser.email);
        setupChatInterface();
    } else {
        console.log('⚠️ Usuário não logado - modo somente visualização');
        document.getElementById('guestMessageSection').style.display = 'flex';
        document.getElementById('chatInterface').style.display = 'none';
    }
    
    // Configurar interface comum
    setupUserInterface();

    console.log('✅ Chat inicializado!');
});

// Configurar interface do usuário
function setupUserInterface() {
    const loggedUserArea = document.getElementById('loggedUserArea');
    const guestUserArea = document.getElementById('guestUserArea');
    const headerUserName = document.getElementById('headerUserName');
    const headerUserEmail = document.getElementById('headerUserEmail');
    
    if (currentUser) {
        console.log('🔧 Configurando interface para usuário logado:', currentUser.nome);
        
        // Mostrar área do usuário logado
        if (loggedUserArea) loggedUserArea.style.display = 'block';
        if (guestUserArea) guestUserArea.style.display = 'none';
        
        // Atualizar informações do usuário
        if (headerUserName) headerUserName.textContent = currentUser.nome;
        if (headerUserEmail) headerUserEmail.textContent = currentUser.email;
        
        // Atualizar foto de perfil no header
        const headerUserAvatar = document.getElementById('headerUserAvatar');
        if (headerUserAvatar) {
            const fotoUrl = currentUser.foto_perfil_url || currentUser.foto_perfil;
            console.log('📷 Tentando carregar foto de perfil:', fotoUrl);
            if (fotoUrl) {
                headerUserAvatar.src = fotoUrl;
                headerUserAvatar.alt = `Foto de ${currentUser.nome}`;
                headerUserAvatar.onerror = function() {
                    console.warn('⚠️ Erro ao carregar foto de perfil, usando padrão');
                    this.src = '../assets/imagens/Logo.png';
                    this.onerror = null;
                };
            } else {
                console.log('📷 Nenhuma foto de perfil encontrada, usando padrão');
                headerUserAvatar.src = '../assets/imagens/Logo.png';
                headerUserAvatar.alt = 'Avatar padrão';
            }
        }
    } else {
        console.log('🔧 Configurando interface para visitante');
        if (loggedUserArea) loggedUserArea.style.display = 'none';
        if (guestUserArea) guestUserArea.style.display = 'block';
    }
    
    // Configurar botões de navegação
    const feedBtn = document.getElementById('feedBtn');
    const profileBtn = document.getElementById('profileBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const startChatBtn = document.getElementById('startChatBtn');
    
    if (feedBtn) {
        feedBtn.addEventListener('click', () => {
            window.location.href = '/feed';
        });
    }
    
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            window.location.href = '/profile';
        });
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            handleLogout();
        });
    }
    
    if (startChatBtn) {
        startChatBtn.addEventListener('click', () => {
            openNewChatModal();
        });
    }
}

// Configurar interface do chat
function setupChatInterface() {
    document.getElementById('guestMessageSection').style.display = 'none';
    document.getElementById('chatInterface').style.display = 'flex';
    
    // Inicializar Pusher
    initializePusher();
    
    // Carregar conversas
    loadConversations();
    
    // Configurar formulário de mensagem
    const messageForm = document.getElementById('messageForm');
    if (messageForm) {
        messageForm.addEventListener('submit', handleSendMessage);
    }
    
    // Configurar busca de conversas
    const searchConversation = document.getElementById('searchConversation');
    if (searchConversation) {
        searchConversation.addEventListener('input', filterConversations);
    }
    
    // Configurar botão de nova conversa
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', openNewChatModal);
    }
    
    // Configurar modal de nova conversa
    setupNewChatModal();
}

// Inicializar Pusher (substitui Socket.IO)
function initializePusher() {
    console.log('🔌 Inicializando Pusher...');
    
    pusher = new Pusher(PUSHER_KEY, {
        cluster: PUSHER_CLUSTER,
        encrypted: true
    });
    
    pusher.connection.bind('connected', () => {
        console.log('✅ Pusher conectado!');
    });
    
    pusher.connection.bind('error', (err) => {
        console.error('❌ Erro de conexão Pusher:', err);
    });
}

// Inscrever-se no canal da conversa
function subscribeToConversation(conversaId) {
    // Desinscrever do canal anterior se existir
    if (activeChannel) {
        pusher.unsubscribe(`chat-${activeConversationId}`);
    }
    
    // Inscrever no novo canal
    activeChannel = pusher.subscribe(`chat-${conversaId}`);
    
    // Escutar novas mensagens
    activeChannel.bind('nova-mensagem', (data) => {
        console.log('📩 Nova mensagem recebida via Pusher:', data);
        
        // Só adicionar se não for nossa própria mensagem (já adicionamos otimisticamente)
        if (data.usuario_id != currentUser.id) {
            appendMessage(data);
        }
        
        // Atualizar lista de conversas
        loadConversations();
    });
    
    // Escutar mensagens lidas
    activeChannel.bind('mensagens-lidas', (data) => {
        console.log('👁️ Mensagens marcadas como lidas:', data);
        if (data.lido_por != currentUser.id) {
            updateMessagesStatus('lida');
        }
    });
    
    // Escutar indicador de digitação
    activeChannel.bind('digitando', (data) => {
        console.log('⌨️ Usuário digitando:', data);
        if (data.usuario_id != currentUser.id) {
            showTypingIndicator(data.usuario_nome);
        }
    });
    
    console.log(`📡 Inscrito no canal chat-${conversaId}`);
}

// Carregar conversas do usuário
async function loadConversations() {
    try {
        const conversationsList = document.getElementById('conversationsList');
        if (!conversationsList) return;
        
        conversationsList.innerHTML = '<div class="loading-msg">Carregando conversas...</div>';
        
        const response = await fetch(`${API_BASE_URL}/chat/conversas/${currentUser.id}`);
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Conversas carregadas:', data.data.length);
            
            if (data.data.length === 0) {
                conversationsList.innerHTML = '<div class="loading-msg">Nenhuma conversa encontrada</div>';
                return;
            }
            
            conversationsList.innerHTML = '';
            
            data.data.forEach(conversa => {
                const conversationItem = createConversationItem(conversa);
                conversationsList.appendChild(conversationItem);
            });
        } else {
            console.log('❌ Erro ao carregar conversas:', data.message);
            conversationsList.innerHTML = '<div class="loading-msg">Erro ao carregar conversas</div>';
        }
    } catch (error) {
        console.error('❌ Erro ao carregar conversas:', error);
        document.getElementById('conversationsList').innerHTML = 
            '<div class="loading-msg">Erro de conexão</div>';
    }
}

// Criar item de conversa
function createConversationItem(conversa) {
    const conversationItem = document.createElement('div');
    conversationItem.className = 'conversation-item';
    conversationItem.dataset.conversaId = conversa.id;
    
    if (activeConversationId && conversa.id == activeConversationId) {
        conversationItem.classList.add('active');
    }
    
    let avatarHtml = '';
    let nomeExibicao = conversa.nome || 'Conversa';
    
    if (conversa.tipo === 'individual' && conversa.outro_usuario) {
        nomeExibicao = conversa.outro_usuario.nome;
        
        if (conversa.outro_usuario.foto_perfil) {
            avatarHtml = `<img src="${conversa.outro_usuario.foto_perfil}" alt="Avatar de ${conversa.outro_usuario.nome}">`;
        } else {
            const iniciais = conversa.outro_usuario.nome.charAt(0).toUpperCase();
            avatarHtml = `<div class="avatar-placeholder">${iniciais}</div>`;
        }
    } else {
        avatarHtml = `<div class="avatar-placeholder">${nomeExibicao.charAt(0).toUpperCase()}</div>`;
    }
    
    let previewText = '';
    let timeText = '';
    
    if (conversa.ultima_mensagem) {
        previewText = conversa.ultima_mensagem.conteudo;
        if (previewText.length > 30) {
            previewText = previewText.substring(0, 30) + '...';
        }
        timeText = formatDate(conversa.ultima_mensagem.data_envio);
    } else {
        previewText = 'Nenhuma mensagem';
        timeText = formatDate(conversa.data_criacao);
    }
    
    const unreadBadge = conversa.nao_lidas > 0 
        ? `<span class="unread-badge">${conversa.nao_lidas}</span>`
        : '';
    
    conversationItem.innerHTML = `
        <div class="conversation-avatar">
            ${avatarHtml}
        </div>
        <div class="conversation-content">
            <div class="conversation-top">
                <span class="conversation-name">${nomeExibicao}</span>
                <span class="conversation-time">${timeText}</span>
            </div>
            <p class="conversation-preview">${previewText}</p>
        </div>
        ${unreadBadge}
    `;
    
    conversationItem.addEventListener('click', () => {
        loadConversation(conversa.id);
    });
    
    return conversationItem;
}

// Carregar conversa específica
async function loadConversation(conversaId) {
    try {
        console.log('🔄 Carregando conversa:', conversaId);
        
        activeConversationId = conversaId;
        
        // Inscrever-se no canal Pusher desta conversa
        subscribeToConversation(conversaId);
        
        // Atualizar UI
        const conversationItems = document.querySelectorAll('.conversation-item');
        conversationItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.conversaId == conversaId) {
                item.classList.add('active');
            }
        });
        
        // Mostrar estado de chat ativo
        document.getElementById('emptyChatState').style.display = 'none';
        document.getElementById('activeChatState').style.display = 'flex';
        
        // Carregar mensagens
        const response = await fetch(`${API_BASE_URL}/chat/mensagens/${conversaId}?usuarioId=${currentUser.id}`);
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Mensagens carregadas:', data.data.length);
            
            loadConversationHeader(conversaId);
            
            const messagesContainer = document.getElementById('messagesContainer');
            messagesContainer.innerHTML = '';
            
            if (data.data.length === 0) {
                messagesContainer.innerHTML = `
                    <div class="empty-messages" style="text-align: center; padding: 2rem; color: #9CA0A1; font-style: italic;">
                        <p>Nenhuma mensagem ainda. Seja o primeiro a enviar!</p>
                    </div>
                `;
            } else {
                data.data.forEach(message => {
                    appendMessage(message, false);
                });
                scrollToBottom();
            }
            
            document.getElementById('messageInput').focus();
            
            // Marcar mensagens como lidas
            markMessagesAsRead(conversaId);
            
            setTimeout(() => {
                loadConversations();
            }, 500);
        } else {
            console.log('❌ Erro ao carregar mensagens:', data.message);
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar conversa:', error);
        showToast('Erro ao carregar conversa', 'error');
    }
}

// Marcar mensagens como lidas via API
async function markMessagesAsRead(conversaId) {
    try {
        await fetch(`${API_BASE_URL}/chat/mensagens/lidas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                conversaId: conversaId,
                usuarioId: currentUser.id
            })
        });
    } catch (error) {
        console.error('Erro ao marcar mensagens como lidas:', error);
    }
}

// Carregar informações do cabeçalho da conversa
async function loadConversationHeader(conversaId) {
    try {
        console.log('🔄 Carregando cabeçalho da conversa:', conversaId);
        const response = await fetch(`${API_BASE_URL}/chat/conversas/${currentUser.id}`);
        const data = await response.json();
        
        if (data.success) {
            const conversa = data.data.find(c => c.id == conversaId);
            
            if (conversa) {
                const chatUserName = document.getElementById('chatUserName');
                const chatUserAvatar = document.getElementById('chatUserAvatar').querySelector('img');
                
                let nomeExibicao = conversa.nome || 'Conversa';
                let avatarSrc = '../assets/imagens/Logo.png';
                
                if (conversa.tipo === 'individual' && conversa.outro_usuario) {
                    currentChatUser = {
                        id: conversa.outro_usuario.id,
                        nome: conversa.outro_usuario.nome,
                        email: conversa.outro_usuario.email,
                        foto_perfil: conversa.outro_usuario.foto_perfil
                    };
                    
                    nomeExibicao = conversa.outro_usuario.nome;
                    
                    if (conversa.outro_usuario.foto_perfil) {
                        avatarSrc = conversa.outro_usuario.foto_perfil;
                    }
                } else {
                    currentChatUser = null;
                }
                
                chatUserName.textContent = nomeExibicao;
                chatUserAvatar.src = avatarSrc;
                chatUserAvatar.alt = `Avatar de ${nomeExibicao}`;
                
                if (conversa.tipo === 'individual') {
                    document.getElementById('chatOptionsBtn').style.display = 'flex';
                } else {
                    document.getElementById('chatOptionsBtn').style.display = 'none';
                }
            }
        }
    } catch (error) {
        console.error('❌ Erro ao carregar cabeçalho da conversa:', error);
    }
}

// Adicionar mensagem à lista
function appendMessage(message, scroll = true) {
    const messagesContainer = document.getElementById('messagesContainer');
    
    const emptyMessage = messagesContainer.querySelector('.empty-messages');
    if (emptyMessage) {
        emptyMessage.remove();
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.dataset.messageId = message.id;
    
    const isSent = message.usuario_id == currentUser.id;
    messageElement.classList.add(isSent ? 'sent' : 'received');
    
    let avatarHtml = '';
    if (!isSent && message.foto_perfil) {
        avatarHtml = `<div class="message-avatar"><img src="${message.foto_perfil}" alt="Avatar"></div>`;
    } else if (!isSent) {
        const iniciais = message.usuario_nome ? message.usuario_nome.charAt(0).toUpperCase() : 'U';
        avatarHtml = `<div class="message-avatar"><div class="avatar-placeholder">${iniciais}</div></div>`;
    } else if (isSent) {
        if (currentUser.foto_perfil) {
            avatarHtml = `<div class="message-avatar"><img src="${currentUser.foto_perfil}" alt="Avatar"></div>`;
        } else {
            const iniciais = currentUser.nome ? currentUser.nome.charAt(0).toUpperCase() : 'U';
            avatarHtml = `<div class="message-avatar"><div class="avatar-placeholder">${iniciais}</div></div>`;
        }
    }
    
    messageElement.innerHTML = `
        <div class="message-content">${message.conteudo}</div>
        ${avatarHtml}
    `;
    
    messagesContainer.appendChild(messageElement);
    
    const typingIndicator = document.querySelector('.typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
    
    if (scroll) {
        scrollToBottom();
    }
}

// Rolar para a última mensagem
function scrollToBottom() {
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Enviar mensagem via API (Pusher envia em tempo real)
async function handleSendMessage(event) {
    event.preventDefault();
    
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message) {
        return;
    }
    
    if (!activeConversationId) {
        showToast('Selecione uma conversa para enviar mensagens', 'error');
        return;
    }
    
    try {
        console.log('📤 Enviando mensagem para conversa:', activeConversationId);
        
        // Limpar campo imediatamente
        messageInput.value = '';
        messageInput.focus();
        
        // Adicionar mensagem otimisticamente (aparece antes da resposta do servidor)
        const tempMessage = {
            id: Date.now(),
            usuario_id: currentUser.id,
            usuario_nome: currentUser.nome,
            foto_perfil: currentUser.foto_perfil,
            conteudo: message,
            data_envio: new Date().toISOString(),
            status: 'enviada'
        };
        appendMessage(tempMessage);
        
        // Enviar para o servidor
        const response = await fetch(`${API_BASE_URL}/chat/mensagens/enviar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                conversaId: activeConversationId,
                usuarioId: currentUser.id,
                conteudo: message
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            console.error('❌ Erro ao enviar mensagem:', data.message);
            showToast('Erro ao enviar mensagem', 'error');
        }
    } catch (error) {
        console.error('❌ Erro ao enviar mensagem:', error);
        showToast('Erro ao enviar mensagem', 'error');
    }
}

// Mostrar indicador de digitação
function showTypingIndicator(userName) {
    const existing = document.querySelector('.typing-indicator');
    if (existing) {
        return;
    }
    
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.textContent = `${userName || 'Alguém'} está digitando...`;
    
    document.getElementById('messagesContainer').appendChild(indicator);
    scrollToBottom();
    
    setTimeout(() => {
        const indicator = document.querySelector('.typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }, 3000);
}

// Atualizar status das mensagens
function updateMessagesStatus(status) {
    const messages = document.querySelectorAll('.message.sent');
    
    messages.forEach(message => {
        const messageTime = message.querySelector('.message-time');
        if (messageTime && status === 'lida' && !messageTime.innerHTML.includes('✓')) {
            messageTime.innerHTML = messageTime.innerHTML + ' ✓';
        }
    });
}

// Configurar modal de nova conversa
function setupNewChatModal() {
    const modal = document.getElementById('newChatModal');
    const closeBtn = modal.querySelector('.close-modal');
    const searchUser = document.getElementById('searchUser');
    
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    let searchTimeout;
    searchUser.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        
        const term = searchUser.value.trim();
        
        if (term.length < 2) {
            document.getElementById('userSearchResults').innerHTML = '';
            return;
        }
        
        searchTimeout = setTimeout(() => {
            searchUsers(term);
        }, 500);
    });
}

// Abrir modal de nova conversa
function openNewChatModal() {
    const modal = document.getElementById('newChatModal');
    modal.style.display = 'flex';
    document.getElementById('searchUser').value = '';
    document.getElementById('searchUser').focus();
    document.getElementById('userSearchResults').innerHTML = '';
}

// Buscar usuários para nova conversa
async function searchUsers(term) {
    try {
        const searchResults = document.getElementById('userSearchResults');
        searchResults.innerHTML = '<div class="loading-msg">Buscando...</div>';
        
        const response = await fetch(`${API_BASE_URL}/chat/usuarios/buscar?termo=${term}&usuarioId=${currentUser.id}`);
        const data = await response.json();
        
        if (data.success) {
            if (data.data.length === 0) {
                searchResults.innerHTML = '<div class="loading-msg">Nenhum usuário encontrado</div>';
                return;
            }
            
            searchResults.innerHTML = '';
            
            data.data.forEach(user => {
                const userItem = document.createElement('div');
                userItem.className = 'user-item';
                
                let avatarHtml = '';
                if (user.foto_perfil) {
                    avatarHtml = `<img src="${user.foto_perfil}" alt="Avatar de ${user.nome}">`;
                } else {
                    const iniciais = user.nome.charAt(0).toUpperCase();
                    avatarHtml = `<div class="avatar-placeholder">${iniciais}</div>`;
                }
                
                userItem.innerHTML = `
                    <div class="user-item-avatar">
                        ${avatarHtml}
                    </div>
                    <div class="user-item-info">
                        <div class="user-item-name">${user.nome}</div>
                        <div class="user-item-email">${user.email}</div>
                    </div>
                `;
                
                userItem.addEventListener('click', () => {
                    createConversation(user.id);
                });
                
                searchResults.appendChild(userItem);
            });
        } else {
            searchResults.innerHTML = '<div class="loading-msg">Erro ao buscar usuários</div>';
        }
    } catch (error) {
        console.error('❌ Erro ao buscar usuários:', error);
        document.getElementById('userSearchResults').innerHTML = 
            '<div class="loading-msg">Erro de conexão</div>';
    }
}

// Criar nova conversa
async function createConversation(outroUsuarioId) {
    try {
        console.log('🔄 Criando conversa com usuário:', outroUsuarioId);
        
        const response = await fetch(`${API_BASE_URL}/chat/conversas/criar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                usuarioId: currentUser.id,
                outroUsuarioId,
                tipo: 'individual'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Conversa criada:', data.data.id);
            
            document.getElementById('newChatModal').style.display = 'none';
            
            await loadConversations();
            loadConversation(data.data.id);
        } else {
            console.log('❌ Erro ao criar conversa:', data.message);
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('❌ Erro ao criar conversa:', error);
        showToast('Erro ao criar conversa', 'error');
    }
}

// Filtrar conversas
function filterConversations() {
    const term = document.getElementById('searchConversation').value.trim().toLowerCase();
    const conversations = document.querySelectorAll('.conversation-item');
    
    conversations.forEach(conversation => {
        const name = conversation.querySelector('.conversation-name').textContent.toLowerCase();
        const preview = conversation.querySelector('.conversation-preview').textContent.toLowerCase();
        
        if (name.includes(term) || preview.includes(term)) {
            conversation.style.display = 'flex';
        } else {
            conversation.style.display = 'none';
        }
    });
}

// Monitorar digitação
let typingTimeout;
document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('input', () => {
            if (!activeConversationId) return;
            
            clearTimeout(typingTimeout);
            
            // Enviar notificação de digitação via API
            fetch(`${API_BASE_URL}/chat/digitando`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    conversaId: activeConversationId,
                    usuarioId: currentUser.id,
                    usuarioNome: currentUser.nome
                })
            }).catch(err => console.log('Erro ao enviar typing:', err));
            
            typingTimeout = setTimeout(() => {
                // Timeout para parar de mostrar "está digitando"
            }, 2000);
        });
    }
});

// Utilitários
function getCurrentUser() {
    try {
        const userStr = localStorage.getItem('currentUser');
        if (userStr) {
            const user = JSON.parse(userStr);
            console.log('👤 Usuário carregado do localStorage:', user.nome);
            return user;
        }
        return null;
    } catch (error) {
        console.error('Erro ao recuperar usuário:', error);
        localStorage.removeItem('currentUser');
        return null;
    }
}

function formatDate(dateString) {
    try {
        let date = new Date(dateString);
        
        if (isNaN(date.getTime())) {
            if (typeof dateString === 'string' && dateString.includes('-')) {
                const parts = dateString.split(/[- :]/);
                date = new Date(parts[0], parts[1]-1, parts[2], parts[3] || 0, parts[4] || 0, parts[5] || 0);
            }
        }
        
        if (isNaN(date.getTime())) {
            return 'Agora';
        }
        
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Agora';
        if (diffInMinutes < 60) return `${diffInMinutes}m`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
        if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d`;
        
        return date.toLocaleDateString('pt-BR');
    } catch (error) {
        return 'Agora';
    }
}

function handleLogout() {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userToken');
        
        if (pusher) {
            pusher.disconnect();
        }
        
        console.log('👋 Logout realizado');
        showToast('Logout realizado com sucesso!', 'success');
        
        setTimeout(() => {
            window.location.href = '/home';
        }, 1000);
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    }, 4000);
}

// Variável para armazenar informações do usuário atual do chat
let currentChatUser = null;

// Configurar menu dropdown e opções
document.addEventListener('DOMContentLoaded', function() {
    const chatOptionsBtn = document.getElementById('chatOptionsBtn');
    const dropdownMenu = document.getElementById('chatDropdownMenu');
    const viewProfileBtn = document.getElementById('viewProfileBtn');
    const blockUserBtn = document.getElementById('blockUserBtn');
    const reportBtn = document.getElementById('reportBtn');
    
    if (chatOptionsBtn) {
        chatOptionsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });
    }
    
    document.addEventListener('click', function() {
        if (dropdownMenu && dropdownMenu.classList.contains('show')) {
            dropdownMenu.classList.remove('show');
        }
    });
    
    if (dropdownMenu) {
        dropdownMenu.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
    
    if (viewProfileBtn) {
        viewProfileBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (currentChatUser && currentChatUser.id) {
                window.location.href = `/html/user-profile.html?user=${currentChatUser.id}`;
            } else {
                showToast('Não foi possível encontrar o perfil do usuário', 'error');
            }
            
            if (dropdownMenu) dropdownMenu.classList.remove('show');
        });
    }
    
    if (blockUserBtn) {
        blockUserBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (currentChatUser && currentChatUser.id) {
                if (confirm(`Tem certeza que deseja bloquear ${currentChatUser.nome}?`)) {
                    showToast('Função não implementada ainda', 'info');
                }
            } else {
                showToast('Não foi possível encontrar o usuário', 'error');
            }
            
            if (dropdownMenu) dropdownMenu.classList.remove('show');
        });
    }
    
    if (reportBtn) {
        reportBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (currentChatUser && currentChatUser.id) {
                showToast('Função não implementada ainda', 'info');
            } else {
                showToast('Não foi possível encontrar o usuário', 'error');
            }
            
            if (dropdownMenu) dropdownMenu.classList.remove('show');
        });
    }
});
