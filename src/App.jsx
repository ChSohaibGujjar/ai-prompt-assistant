import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

function CodeBlock({ children }) {

  const [copied, setCopied] = useState(false)

  const codeElement = Array.isArray(children)
    ? children[0]
    : children

  const code = String(
    codeElement?.props?.children ?? ''
  ).replace(/\n$/, '')

  const language =
    codeElement?.props?.className?.replace('language-', '') || 'code'

  const handleCopy = async () => {

    try {

      await navigator.clipboard.writeText(code)

      setCopied(true)

      setTimeout(() => {
        setCopied(false)
      }, 1500)

    } catch (error) {

      console.error('Copy failed:', error)

    }

  }

  return (
    <div className="markdown-code-block">

      <div className="markdown-code-header">

        <span>{language}</span>

        <button
          type="button"
          className="markdown-copy-button"
          onClick={handleCopy}
          title="Copy code"
        >

          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="8" y="8" width="13" height="13" rx="2" />
            <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
          </svg>

          {copied ? 'Copied!' : 'Copy'}

        </button>

      </div>

      <pre>
        <code>{code}</code>
      </pre>

    </div>
  )

}

function MarkdownAnswer({ content }) {

  return (
    <div className="markdown-answer">

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            return <CodeBlock>{children}</CodeBlock>
          },

          a({ href, children }) {
            const isGeneratedImage =
              href?.includes('/generated_images/')

            return (
              <a
                href={href}
                download={isGeneratedImage ? true : undefined}
                target={isGeneratedImage ? undefined : '_blank'}
                rel="noreferrer"
                style={{
                  color: '#4f46e5',
                  fontWeight: '600'
                }}
              >
                {children}
              </a>
            )
          },

          img({ src, alt }) {
            return (
              <img
                src={src}
                alt={alt || 'Generated Image'}
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  width: 'auto',
                  maxHeight: '500px',
                  borderRadius: '12px',
                  marginTop: '12px',
                  objectFit: 'contain'
                }}
              />
            )
          }
        }}
      >
        {content || ''}
      </ReactMarkdown>

    </div>
  )

}

function App() {

const API = '/backend/';

  const [prompts, setPrompts] = useState([])
  const [selectedPrompt, setSelectedPrompt] = useState('')
  const [context, setContext] = useState('')
  const [question, setQuestion] = useState('')
  const [isRecording, setIsRecording] = useState(false)
const [isTranscribing, setIsTranscribing] = useState(false)

const mediaRecorderRef = useRef(null)
const audioChunksRef = useRef([])
  const [answer, setAnswer] = useState('')
const [lastQuestion, setLastQuestion] = useState('')
  const [loading, setLoading] = useState(true)
  const [isAsking, setIsAsking] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const abortControllerRef = useRef(null)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // User Authentication
// User Authentication
const [authUser, setAuthUser] = useState(() => {
  try {
    return JSON.parse(localStorage.getItem('authUser') || 'null')
  } catch {
    return null
  }
})

const [authToken, setAuthToken] = useState(
  localStorage.getItem('authToken') || ''
)

const [showUserMenu, setShowUserMenu] = useState(false)
const [showDeleteAllModal, setShowDeleteAllModal] = useState(false)
const [showAuthModal, setShowAuthModal] = useState(false)
const [showGuestNewChatModal, setShowGuestNewChatModal] = useState(false)
const [authMode, setAuthMode] = useState('login')
const [authName, setAuthName] = useState('')
const [authEmail, setAuthEmail] = useState('')
const [authPassword, setAuthPassword] = useState('')
const [authMessage, setAuthMessage] = useState('')
const [authLoading, setAuthLoading] = useState(false)

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [selectedChat, setSelectedChat] = useState(null)

  const [conversationId, setConversationId] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [showArchived, setShowArchived] = useState(false)

  // Group messages by conversation
  const groupConversations = (messages) => {

    const groups = {}

    messages.forEach((chat) => {

      const key = chat.conversation_id
        ? chat.conversation_id
        : `legacy-${chat.id}`

      if (!groups[key]) {

        groups[key] = {
          conversation_id: chat.conversation_id,
          id: chat.id,
          title: chat.conversation_title || chat.question,
          is_pinned: Number(chat.is_pinned || 0),
          is_archived: Number(chat.is_archived || 0),
          share_token: chat.share_token,
          messages: []
        }

      }

      groups[key].messages.push(chat)

    })

    return Object.values(groups).map((conversation) => {

      conversation.messages.sort(
        (a, b) => Number(a.id) - Number(b.id)
      )

      return conversation

    })

  }

  // Load System Prompts
  useEffect(() => {

    fetch(API)
      .then(response => {

        if (!response.ok) {
          throw new Error('API request failed')
        }

        return response.json()

      })
      .then(result => {

        if (result.success) {

          setPrompts(result.data)

          if (result.data.length > 0) {
            setSelectedPrompt(String(result.data[0].id))
          }

        } else {

          setError('Unable to load system prompts.')

        }

      })
      .catch(error => {

        console.error('API Error:', error)
        setError('Backend connection failed.')

      })
      .finally(() => {

        setLoading(false)

      })

  }, [])

// Load Chat History
const loadHistory = async (token = authToken) => {

  try {

    const headers = {}

   if (token) {
  headers['Authorization'] = `Bearer ${token}`
}

    const response = await fetch(API + 'history.php', {
      method: 'GET',
      headers: headers
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error('Unable to load chat history.')
    }

    const conversations = groupConversations(result.data)

    setHistory(conversations)

    return conversations

  } catch (error) {

    console.error('History Error:', error)

    return []

  } finally {

    setHistoryLoading(false)

  }

}

  // Load History when Page Opens
  useEffect(() => {

    loadHistory()

  }, [])

  // Conversation Management API
const manageConversation = async (action, chatId, extraData = {}) => {

  try {

    const headers = {
      'Content-Type': 'application/json'
    }

    // Add login token if user is logged in
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    const response = await fetch(API + 'conversation.php', {

      method: 'POST',

      headers: headers,

      body: JSON.stringify({
        action: action,
        conversation_id: chatId,
        ...extraData
      })

    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Action failed.')
    }

    return result

  } catch (error) {

    alert(error.message)
    return null

  }

}

// Delete All Chats
const handleDeleteAllChats = async () => {

  try {

    const result = await manageConversation('delete_all', '')

    if (!result) {
      return
    }

   // Clear chats from sidebar
setHistory([])

// Clear current chat
setAnswer('')
setQuestion('')
setLastQuestion('') 

    alert('All chats deleted successfully!')

  } catch (error) {

    console.error('Delete All Error:', error)

  }

}

  // User Login and Register
  const handleAuthSubmit = async (e) => {

    e.preventDefault()

    setAuthLoading(true)
    setAuthMessage('')

    try {

      const action = authMode === 'register' ? 'register' : 'login'

      const response = await fetch(API + 'auth.php', {

        method: 'POST',

       headers: {
  'Content-Type': 'application/json',
  ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
},

        body: JSON.stringify({
          action: action,
          name: authName,
          email: authEmail,
          password: authPassword
        })

      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Authentication failed.')
      }

      // Registration successful
      if (action === 'register') {

        setAuthMode('login')
        setAuthPassword('')
        setAuthMessage('Account created successfully! Please login.')

      }

      // Login successful
      else {

        localStorage.setItem('authToken', result.token)
        localStorage.setItem('authUser', JSON.stringify(result.user))

  setAuthToken(result.token)
setAuthUser(result.user)

// Start a fresh account conversation
handleNewChat()

// Load logged-in user's chat history
await loadHistory(result.token)

setShowAuthModal(false)
        setAuthPassword('')
        setAuthName('')
        setAuthEmail('')
        setAuthMessage('')
window.location.reload()
      }

    } catch (error) {

      setAuthMessage(error.message)

    } finally {

      setAuthLoading(false)

    }

  }

 // User Logout
const handleLogout = async () => {

  try {

    await fetch(API + 'auth.php', {

      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },

      body: JSON.stringify({
        action: 'logout'
      })

    })

  } catch (error) {

    console.log('Logout error:', error)

  }

  localStorage.removeItem('authToken')
  localStorage.removeItem('authUser')

  setAuthToken('')
  setAuthUser(null)
  setShowUserMenu(false)

  window.location.reload()

}
  // Refresh History
  const refreshHistory = async (selectedId = conversationId) => {

    const updatedHistory = await loadHistory()

    if (selectedId) {

      const updatedChat = updatedHistory.find(
        chat => chat.conversation_id === selectedId
      )

      if (updatedChat) {
        setSelectedChat(updatedChat)
      } else {
        setSelectedChat(null)
        setConversationId(null)
      }

    }

  }

  // Start New Chat
  const handleNewChat = () => {

    setConversationId(null)
    setSelectedChat(null)
    setQuestion('')
    setContext('')
    setAnswer('')
    setError('')
    setOpenMenuId(null)
    setShowArchived(false)

  }

  const handleGuestClearChat = () => {
  handleNewChat()
  setLastQuestion('')
  setShowGuestNewChatModal(false)
}

  // Open Previous Conversation
  const handleSelectChat = (chat) => {

    setSelectedChat(chat)
    setConversationId(chat.conversation_id || null)

    setQuestion('')
    setContext('')
    setAnswer('')
    setError('')
    setOpenMenuId(null)

    if (chat.messages.length > 0) {
      setSelectedPrompt(String(chat.messages[0].prompt_id))
    }

  }

  // Rename Conversation
  const handleRename = async (chat) => {

    const newTitle = window.prompt(
      'Enter new conversation name:',
      chat.title
    )

    if (newTitle === null) {
      setOpenMenuId(null)
      return
    }

    if (!newTitle.trim()) {
      alert('Conversation name cannot be empty.')
      setOpenMenuId(null)
      return
    }

    const result = await manageConversation(
      'rename',
      chat.conversation_id,
      { title: newTitle.trim() }
    )

    if (result) {

      await refreshHistory(chat.conversation_id)

      setOpenMenuId(null)

      alert('Conversation renamed successfully!')

    }

  }

  // Pin / Unpin Conversation
  const handlePin = async (chat) => {

    const newStatus = Number(chat.is_pinned) === 1 ? 0 : 1

    const result = await manageConversation(
      'pin',
      chat.conversation_id,
      { status: newStatus }
    )

    if (result) {

      await refreshHistory(chat.conversation_id)
      setOpenMenuId(null)

    }

  }

  // Archive / Unarchive Conversation
  const handleArchive = async (chat) => {

    const newStatus = Number(chat.is_archived) === 1 ? 0 : 1

    const result = await manageConversation(
      'archive',
      chat.conversation_id,
      { status: newStatus }
    )

    if (result) {

      await refreshHistory(
        newStatus === 1 ? null : chat.conversation_id
      )

      setOpenMenuId(null)

      if (newStatus === 1) {
        setShowArchived(false)
      }

      alert(
        newStatus === 1
          ? 'Conversation archived successfully!'
          : 'Conversation restored successfully!'
      )

    }

  }

  // Delete Conversation
  const handleDelete = async (chat) => {

    const confirmed = window.confirm(
      'Are you sure you want to delete this conversation? This cannot be undone.'
    )

    if (!confirmed) {
      setOpenMenuId(null)
      return
    }

    const result = await manageConversation(
      'delete',
      chat.conversation_id
    )

    if (result) {

      if (conversationId === chat.conversation_id) {

        setConversationId(null)
        setSelectedChat(null)
        setQuestion('')
        setContext('')
        setAnswer('')

      }

      await refreshHistory(null)

      setOpenMenuId(null)

      alert('Conversation deleted successfully!')

    }

  }

  // Delete All Conversations
const handleDeleteAll = async () => {

  const result = await manageConversation('delete_all', '')

  if (result) {

    setHistory([])
    setConversationId(null)
    setSelectedChat(null)
    setQuestion('')
    setContext('')
    setAnswer('')
    setOpenMenuId(null)

    setShowDeleteAllModal(false)

    alert('All chats deleted successfully!')

  }

}

  // Share Conversation
  const handleShare = async (chat) => {

    const result = await manageConversation(
      'share',
      chat.conversation_id
    )

    if (result && result.share_token) {

      const shareUrl =
        window.location.origin +
        '/shared?token=' +
        result.share_token

      try {

        await navigator.clipboard.writeText(shareUrl)

        alert(
          'Share link copied!\n\nPublic sharing page abhi banana baqi hai.'
        )

      } catch (error) {

        alert(
          'Share token generated:\n' + result.share_token
        )

      }

      setOpenMenuId(null)

      await refreshHistory(chat.conversation_id)

    }

  }

  // Ask AI Function
  const handleAskAI = async () => {

    if (!selectedPrompt) {
      setError('Please select a System Prompt.')
      return
    }

    if (!question.trim()) {
      setError('Please enter your question.')
      return
    }

    setError('')
setAnswer('')
setIsAsking(true)

const controller = new AbortController()
abortControllerRef.current = controller

    try {

      // Check whether user is requesting an image
const imageRequestPattern =
  /(?:bana(?:\s+(?:kar|ky|ke))?\s+do|banao|generate|create|draw|design).{0,80}(?:image|picture|photo|tasveer|logo|banner|poster|thumbnail|wallpaper)|(?:image|picture|photo|tasveer|logo|banner|poster|thumbnail|wallpaper).{0,80}(?:bana(?:\s+(?:kar|ky|ke))?\s+do|banao|generate|create)|(?:koi\s+(?:or|aur)\s+(?:achi|achhi)|ek\s+(?:or|aur)|another\s+one|one\s+more|make\s+another|different\s+one|is\s+se\s+(?:achi|behtar)|aur\s+achi).{0,80}(?:bhej(?:o|na)?|bana(?:\s+(?:ky|ke))?\s+do|banao|generate|create)?|(?:professional|luxury|3d|modern|realistic|cinematic|premium|futuristic|sports\s+car|supercar|house|building|landscape|portrait|nature|interior|exterior|architecture|fashion|product|business\s+card|packaging|illustration|cartoon|anime|wallpaper|logo|poster|banner|thumbnail)\b/i
      
      if (imageRequestPattern.test(question)) {
setIsGeneratingImage(true)
        const imageResponse = await fetch(
          API + 'generate-image.php',
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              prompt: lastQuestion && /(?:koi\s+(?:or|aur)\s+(?:achi|achhi)|ek\s+(?:or|aur)|another\s+one|one\s+more|make\s+another|different\s+one|is\s+se\s+(?:achi|behtar)|aur\s+achi)/i.test(question)
  ? `Create another visually different image based on this original request: ${lastQuestion}. New instruction: ${question}. Keep the same subject and topic, but create a fresh design.`
  : question
            })
          }
        )

        const imageResult = await imageResponse.json()

        if (!imageResponse.ok || !imageResult.success) {
          throw new Error(
            imageResult.message || 'Image generation failed.'
          )
        }

       
        const imageAnswer =
          `![Generated Image](${imageResult.image_url})\n\n[Download Image](${imageResult.image_url})`

        // Save image chat in database

        const saveResponse = await fetch(
          API + 'save-image-chat.php',
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              prompt_id: selectedPrompt,
              context: context,
              question: question,
              conversation_id: conversationId,
              image_url: imageResult.image_url
            })
          }
        )

        const savedResult = await saveResponse.json()

        if (!saveResponse.ok || !savedResult.success) {
          throw new Error(
            savedResult.message || 'Image chat could not be saved.'
          )
        }

        // Update chat screen

        setConversationId(savedResult.conversation_id)
        setLastQuestion(question)
        setAnswer(savedResult.answer || imageAnswer)

        setQuestion('')
        setContext('')

        // Refresh chat history

        const updatedHistory = await loadHistory()

        const currentConversation = updatedHistory.find(
          chat => chat.conversation_id === savedResult.conversation_id
        )

        if (currentConversation) {
          setSelectedChat(currentConversation)
        }

        return

      }


      const response = await fetch(
        API + 'ask.php',
        {
          method: 'POST',
signal: controller.signal,
         headers: {
  'Content-Type': 'application/json',
  ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
},
          body: JSON.stringify({

            prompt_id: selectedPrompt,
            context: context,
            question: question,
            conversation_id: conversationId

          })

        }
      )

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'AI request failed.')
      }

    setConversationId(result.conversation_id)
setLastQuestion(question)
setAnswer(result.answer)

setQuestion('')
      setContext('')

      const updatedHistory = await loadHistory()

      const currentConversation = updatedHistory.find(
        chat => chat.conversation_id === result.conversation_id
      )

      if (currentConversation) {
        setSelectedChat(currentConversation)
      }

   } catch (error) {
  if (error.name === 'AbortError') {
    setAnswer('')
    return
  }

  console.error('AI Error:', error)
  setError(error.message || 'Something went wrong.')
} finally {
  setIsAsking(false)
  setIsGeneratingImage(false)
  abortControllerRef.current = null
}

  }
// Stop AI Generation
const handleStopAI = () => {

  if (abortControllerRef.current) {
    abortControllerRef.current.abort()
  }

  setIsAsking(false)
  setIsGeneratingImage(false)
  setAnswer('')
  setError('')

}

// Start Voice Recording
const handleStartRecording = async () => {

  try {

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    })

    audioChunksRef.current = []

    const mediaRecorder = new MediaRecorder(stream)

    mediaRecorderRef.current = mediaRecorder

    mediaRecorder.ondataavailable = (event) => {

      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data)
      }

    }

    mediaRecorder.onstop = async () => {

      setIsRecording(false)
      setIsTranscribing(true)

      const audioBlob = new Blob(
        audioChunksRef.current,
        { type: mediaRecorder.mimeType }
      )

      stream.getTracks().forEach(track => track.stop())

      try {

        const formData = new FormData()

        formData.append("audio", audioBlob, "recording.webm")

        const response = await fetch(
          "http://localhost/ai-prompt-assistant/backend/transcribe.php",
          {
            method: "POST",
            body: formData
          }
        )

        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Transcription failed.")
        }

        setQuestion(previous => {

          const existingText = previous.trim()

          if (existingText === "") {
            return data.transcription
          }

          return existingText + " " + data.transcription

        })

      } catch (error) {

        console.error("Transcription Error:", error)

        setError(error.message || "Voice transcription failed.")

      } finally {

        setIsTranscribing(false)

      }

    }

    mediaRecorder.start()

    setIsRecording(true)
    setError('')

  } catch (error) {

    console.error("Microphone Error:", error)

    setError(
      "Microphone access denied. Please allow microphone permission."
    )

  }

}


// Stop Voice Recording
const handleStopRecording = () => {

  if (
    mediaRecorderRef.current &&
    mediaRecorderRef.current.state === "recording"
  ) {

    mediaRecorderRef.current.stop()

  }

}

  // Separate Active and Archived Chats
  const activeChats = history.filter(
    chat => Number(chat.is_archived) !== 1
  )

  const archivedChats = history.filter(
    chat => Number(chat.is_archived) === 1
  )

  // Sort pinned conversations first
  const sortedChats = [...activeChats].sort(
    (a, b) => Number(b.is_pinned) - Number(a.is_pinned)
  )

  return (

   <div
  className="app"
  onMouseDown={() => setOpenMenuId(null)}
  style={{
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  }}
>

      {/* Navbar */}

    <header className="navbar">
      <button
  type="button"
  className="mobile-menu-button"
  onClick={() => setSidebarOpen(!sidebarOpen)}
>
  ☰
</button>

  <h2>AI Prompt</h2>

  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  }}>

   

    {!authUser ? (

      <>
        <button
          onClick={() => {
            setAuthMode('login')
            setAuthMessage('')
            setShowAuthModal(true)
          }}
          style={{
            padding: '9px 16px',
            border: '1px solid #2563eb',
            borderRadius: '8px',
            background: 'white',
            color: '#2563eb',
            cursor: 'pointer'
          }}
        >
          Login
        </button>

        <button
          onClick={() => {
            setAuthMode('register')
            setAuthMessage('')
            setShowAuthModal(true)
          }}
          style={{
            padding: '9px 16px',
            border: 'none',
            borderRadius: '8px',
            background: '#2563eb',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Sign Up
        </button>
      </>

    ) : (

      <div style={{ position: 'relative' }}>

        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          style={{
            padding: '9px 14px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            background: 'white',
            color: '#222',
            cursor: 'pointer'
          }}
        >
          👤 {authUser.name} ▼
        </button>

        {showUserMenu && (

          <div style={{
            position: 'absolute',
            top: '45px',
            right: '0',
            width: '200px',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            zIndex: 1000
          }}>

            <div style={{
              padding: '8px',
              borderBottom: '1px solid #eee',
              marginBottom: '8px'
            }}>
              <strong>{authUser.name}</strong>
              <p style={{
                fontSize: '12px',
                color: '#666',
                margin: '4px 0'
              }}>
                {authUser.email}
              </p>
            </div>

            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '9px',
                border: 'none',
                borderRadius: '6px',
                background: '#fee2e2',
                color: '#dc2626',
                cursor: 'pointer'
              }}
            >
              Logout
            </button>

          </div>

        )}

      </div>

    )}

  </div>

</header>

      {/* Main Workspace */}

      <div
  style={{
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden'
  }}
>


{/* Sidebar Overlay */}

{sidebarOpen && (
  <div
    className="sidebar-overlay"
    onClick={() => setSidebarOpen(false)}
  />
)}
        {/* Sidebar */}

     <aside
  className={`app-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}
  style={{
    width: '280px',
    minWidth: '240px',
    background: '#ffffff',
    borderRight: '1px solid #e5e7eb',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden'
  }}
>

          <button
            type="button"
            onClick={() => {
  if (authUser) {
    handleNewChat()
  } else {
    setShowGuestNewChatModal(true)
  }
}}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              padding: '13px',
              background: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginBottom: '25px'
            }}
          >
            + New Chat
          </button>
{authUser && (
  <>
          <h3 style={{ marginBottom: '15px', fontSize: '17px' }}>
            Chat History
          </h3>

          <div
  style={{
    overflowY: 'auto',
    overflowX: 'hidden',
    flex: 1,
    minHeight: 0
  }}
>

            {historyLoading ? (

              <p style={{ color: '#777' }}>
                Loading history...
              </p>

            ) : (

              <>

                {/* Active Conversations */}

                {sortedChats.length > 0 ? (

                  sortedChats.map((chat) => (

                    <div
                      className="conversation-item"
                      key={chat.conversation_id || `legacy-${chat.id}`}
                      onMouseLeave={() => setOpenMenuId(null)}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '8px',
                        background:
                          selectedChat?.conversation_id === chat.conversation_id &&
                          chat.conversation_id
                            ? '#e0e7ff'
                            : selectedChat?.id === chat.id && !chat.conversation_id
                              ? '#e0e7ff'
                              : '#f4f6fb',
                        borderRadius: '8px'
                      }}
                    >

                      <button
                        type="button"
                        onClick={() => handleSelectChat(chat)}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          textAlign: 'left',
                          padding: '12px',
                          border: 'none',
                          background: 'transparent',
                          color: '#333',
                          cursor: 'pointer'
                        }}
                      >

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 'bold',
                            marginBottom: '5px',
                            fontSize: '14px'
                          }}
                        >

                          {Number(chat.is_pinned) === 1 && (
                            <span title="Pinned">📌</span>
                          )}

                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {chat.title}
                          </span>

                        </div>

                        <small style={{ color: '#777' }}>
                          {chat.messages.length} messages
                        </small>

                      </button>

                      {/* Three Dots Menu */}

                      {chat.conversation_id && (

                        <button
                          type="button"
                          className="conversation-dots"
                          title="More options"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {

                            e.stopPropagation()

                            setOpenMenuId((previousId) =>
                              previousId === chat.conversation_id
                                ? null
                                : chat.conversation_id
                            )

                          }}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            fontSize: '22px',
                            padding: '8px',
                            cursor: 'pointer',
                            color: '#555'
                          }}
                        >
                          ⋮
                        </button>

                      )}

                      {/* Dropdown Menu */}

                      {openMenuId === chat.conversation_id && (

                        <div
                          className="conversation-dropdown"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            right: '5px',
                            top: '42px',
                            width: '175px',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '9px',
                            boxShadow: '0 5px 20px rgba(0,0,0,0.12)',
                            zIndex: 1000,
                            padding: '5px'
                          }}
                        >

                          <button
                            type="button"
                            onClick={() => handleRename(chat)}
                            style={menuButtonStyle}
                          >
                            ✏️ Rename
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePin(chat)}
                            style={menuButtonStyle}
                          >
                            📌 {Number(chat.is_pinned) === 1 ? 'Unpin' : 'Pin'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleArchive(chat)}
                            style={menuButtonStyle}
                          >
                            📦 Archive
                          </button>

                          <button
                            type="button"
                            onClick={() => handleShare(chat)}
                            style={menuButtonStyle}
                          >
                            🔗 Share
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(chat)}
                            style={{
                              ...menuButtonStyle,
                              color: '#dc2626'
                            }}
                          >
                            🗑️ Delete
                          </button>

                        </div>

                      )}

                    </div>

                  ))

                ) : (

                  <p style={{ color: '#777', fontSize: '14px' }}>
                    No chat history yet.
                  </p>

                )}

                {/* Archived Section */}

                {archivedChats.length > 0 && (

                  <div style={{ marginTop: '25px' }}>

                    <button
                      type="button"
                      onClick={() => {

                        setShowArchived(!showArchived)
                        setOpenMenuId(null)

                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        padding: '10px',
                        textAlign: 'left',
                        background: '#f4f6fb',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#333'
                      }}
                    >

                      📦 Archived ({archivedChats.length})

                      <span style={{ float: 'right' }}>
                        {showArchived ? '▲' : '▼'}
                      </span>

                    </button>

                    {showArchived && (

                      <div style={{ marginTop: '10px' }}>

                        {archivedChats.map((chat) => (

                          <div
                            className="conversation-item"
                            key={chat.conversation_id}
                            onMouseLeave={() => setOpenMenuId(null)}
                            style={{
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'center',
                              marginBottom: '8px',
                              background: '#f4f6fb',
                              borderRadius: '8px'
                            }}
                          >

                            <button
                              type="button"
                              onClick={() => handleSelectChat(chat)}
                              onMouseDown={(e) => e.stopPropagation()}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                padding: '12px',
                                textAlign: 'left',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                color: '#333'
                              }}
                            >

                              <div
                                style={{
                                  fontWeight: 'bold',
                                  fontSize: '14px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {chat.title}
                              </div>

                              <small style={{ color: '#777' }}>
                                {chat.messages.length} messages
                              </small>

                            </button>

                            <button
                              type="button"
                              className="conversation-dots"
                              title="More options"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {

                                e.stopPropagation()

                                setOpenMenuId((previousId) =>
                                  previousId === chat.conversation_id
                                    ? null
                                    : chat.conversation_id
                                )

                              }}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                fontSize: '22px',
                                padding: '8px',
                                cursor: 'pointer',
                                color: '#555'
                              }}
                            >
                              ⋮
                            </button>

                            {openMenuId === chat.conversation_id && (

                              <div
                                className="conversation-dropdown"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute',
                                  right: '5px',
                                  top: '42px',
                                  width: '175px',
                                  background: '#fff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '9px',
                                  boxShadow: '0 5px 20px rgba(0,0,0,0.12)',
                                  zIndex: 1000,
                                  padding: '5px'
                                }}
                              >

                                <button
                                  type="button"
                                  onClick={() => handleRename(chat)}
                                  style={menuButtonStyle}
                                >
                                  ✏️ Rename
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleArchive(chat)}
                                  style={menuButtonStyle}
                                >
                                  ↩️ Unarchive
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDelete(chat)}
                                  style={{
                                    ...menuButtonStyle,
                                    color: '#dc2626'
                                  }}
                                >
                                  🗑️ Delete
                                </button>

                              </div>

                            )}

                          </div>

                        ))}

                      </div>

                    )}

                  </div>

                )}

              </>

            )}
          </div>
        </>
      )}
          {/* Delete All Chats Button */}
          {authUser && (

            <button
              type="button"
              onClick={() => setShowDeleteAllModal(true)}
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '12px',
                background: '#fff1f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              🗑️ Delete All Chats
            </button>

          )}
        </aside>

      
        {/* Main Content */}

        <main
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '20px',
            boxSizing: 'border-box'
          }}
        >

          <div
            style={{
              maxWidth: '850px',
              width: '100%',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0
            }}
          >

            {/* Scrollable Chat Messages */}

           <div
  style={{
    flex: '1 1 0',
    minHeight: 0,
    order: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingBottom: '20px'
  }}
>

          {/* Welcome Section */}

<div className="welcome">
  <h1>
    How can I help you{authUser?.name ? `, ${authUser.name}` : ''}?
  </h1>

  <p>
    Ask anything. Get intelligent answers with your custom AI assistant.
  </p>
</div>
            
{/* Selected Conversation */}

{selectedChat && (

  <div style={{
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
    padding: '10px 0'
  }}>

    {selectedChat.messages.map((chat) => (

      <div key={chat.id} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '18px'
      }}>

        {/* User Question - Right Side */}

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            maxWidth: '75%',
            background: '#e0f2fe',
            color: '#222',
            padding: '12px 18px',
            borderRadius: '20px',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.6'
          }}>
            {chat.question}

            {chat.context && (
              <div style={{
                marginTop: '10px',
                color: '#666',
                fontSize: '13px'
              }}>
                {chat.context}
              </div>
            )}
          </div>
        </div>

        {/* AI Answer - Left Side */}

        <div style={{
          display: 'flex',
          justifyContent: 'flex-start'
        }}>
          <div style={{
            maxWidth: '90%',
            color: '#222',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.8'
          }}>
            <MarkdownAnswer content={chat.answer} />
          </div>
        </div>

      </div>

    ))}

  </div>

)}


            
{/* New Chat Messages */}

{!selectedChat && (lastQuestion || answer || isAsking) && (

  <div style={{
    display: 'flex',
    flexDirection: 'column',
    gap: '25px',
    padding: '10px 0'
  }}>

    {/* User Question - Right Side */}

    {lastQuestion && (
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end'
      }}>
        <div style={{
          maxWidth: '75%',
          background: '#e0f2fe',
          color: '#222',
          padding: '12px 18px',
          borderRadius: '20px',
          whiteSpace: 'pre-wrap',
          lineHeight: '1.6'
        }}>
          {lastQuestion}
        </div>
      </div>
    )}

    {/* AI Answer - Left Side */}

    {(answer || isAsking) && (
      <div style={{
        display: 'flex',
        justifyContent: 'flex-start'
      }}>
        <div style={{
          maxWidth: '90%',
          color: '#222',
          padding: '5px 0',
          whiteSpace: 'pre-wrap',
          lineHeight: '1.8'
        }}>
        
      
{isAsking ? (
  isGeneratingImage ? (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '12px 0',
      color: '#4f46e5',
      fontSize: '15px',
      fontWeight: '600'
    }}>
      <span style={{
        width: '18px',
        height: '18px',
        border: '3px solid #c7d2fe',
        borderTop: '3px solid #4f46e5',
        borderRadius: '50%',
        display: 'inline-block',
        animation: 'imageSpin 0.8s linear infinite'
      }} />

      Generating your image...
    </div>
  ) : (
    'AI is thinking. Please wait...'
  )
) : (
  <MarkdownAnswer content={answer} />
)}
 
        </div>
      </div>
    )}

  </div>

)}


            </div>

          
{/* Fixed Bottom Chat Form */}

<div
  className="chat-box"
  style={{
    flex: '0 0 auto',
    order: 2,
    width: '100%',
    margin: 0,
    marginTop: '12px',
    padding: 0,
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    zIndex: 5
  }}
>



  <form
    onSubmit={(e) => {
      e.preventDefault()
      handleAskAI()
    }}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      width: '100%',
      padding: '8px 10px 8px 20px',
      background: '#ffffff',
      border: '1px solid #d1d5db',
      borderRadius: '35px',
      boxShadow: '0 3px 15px rgba(0,0,0,0.07)'
    }}
  >

    <input
      type="text"
    placeholder={
  isRecording
    ? "Listening... Click stop to finish"
    : isTranscribing
      ? "Converting voice to text..."
      
        : "Ask anything..."
}
      value={question}
      onChange={(e) => setQuestion(e.target.value)}
      disabled={isAsking}
      style={{
        flex: 1,
        minWidth: 0,
        border: 'none',
        outline: 'none',
        background: 'transparent',
        fontSize: '16px',
        padding: '10px 0',
        color: '#222'
      }}
    />

    {/* Microphone Button */}

{isRecording ? (

  <button
    type="button"
    onClick={handleStopRecording}
    title="Stop recording"
    style={{
      width: '40px',
      height: '40px',
      minWidth: '40px',
      border: 'none',
      background: 'transparent',
      color: '#dc2626',
      fontSize: '22px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: 0,
      padding: 0
    }}
  >
    ■
  </button>

) : (

  <button
    type="button"
    onClick={handleStartRecording}
    title="Start voice recording"
    style={{
      width: '40px',
      height: '40px',
      minWidth: '40px',
      border: 'none',
      background: 'transparent',
      color: '#111827',
      fontSize: '22px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: 0,
      padding: 0
    }}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  </button>

)}

       {isAsking ? (

      <button
        type="button"
        onClick={handleStopAI}
        title="Stop generating"
       style={{
  width: '44px',
  height: '44px',
  minWidth: '44px',
  borderRadius: '50%',
  border: '2px solid #0284c7',
  background: '#4f46e5',
  color: '#ffffff',
  fontSize: '18px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: 0,
  padding: 0
}}
      >
        ■
      </button>

    ) : (

      <button
        type="submit"
        disabled={loading || prompts.length === 0 || !question.trim()}
        title="Send message"
        style={{
          width: '44px',
          height: '44px',
          minWidth: '44px',
          borderRadius: '50%',
          border: 'none',
          background: '#4f46e5',
          color: '#ffffff',
          fontSize: '25px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
          padding: 0
        }}
      >
        ↑
      </button>

    )}

  </form>

  {error && (
    <p style={{
      color: 'red',
      marginTop: '8px',
      fontSize: '13px'
    }}>
      {error}
    </p>
  )}

</div>


          </div>

        </main>

      </div>

      {/* Footer */}

      <footer>
        AI Custom System Prompt Assistant
      </footer>

{/* Guest New Chat Confirmation Modal */}

{showGuestNewChatModal && (
  <div
    onClick={() => setShowGuestNewChatModal(false)}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2500,
      padding: '20px'
    }}
  >

    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: '440px',
        background: '#ffffff',
        borderRadius: '16px',
        padding: '30px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        boxSizing: 'border-box'
      }}
    >

      <h2
        style={{
          textAlign: 'center',
          margin: '0 0 12px',
          color: '#222'
        }}
      >
        Clear current chat?
      </h2>

      <p
        style={{
          textAlign: 'center',
          color: '#666',
          fontSize: '14px',
          lineHeight: 1.6,
          marginBottom: '25px'
        }}
      >
        To start a new chat, your current conversation will be discarded.{' '}

        <button
          type="button"
          onClick={() => {
            setShowGuestNewChatModal(false)
            setAuthMode('register')
            setAuthMessage('')
            setShowAuthModal(true)
          }}
          style={{
            border: 'none',
            background: 'none',
            padding: 0,
            color: '#4f46e5',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Sign up
        </button>

        {' '}or{' '}

        <button
          type="button"
          onClick={() => {
            setShowGuestNewChatModal(false)
            setAuthMode('login')
            setAuthMessage('')
            setShowAuthModal(true)
          }}
          style={{
            border: 'none',
            background: 'none',
            padding: 0,
            color: '#4f46e5',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          log in
        </button>

        {' '}to save chats.
      </p>

      <div
        style={{
          display: 'flex',
          gap: '10px'
        }}
      >

        <button
          type="button"
          onClick={handleGuestClearChat}
          style={{
            flex: 1,
            padding: '12px',
            border: '1px solid #d1d5db',
            background: '#fff',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            color: '#333'
          }}
        >
          Clear chat
        </button>

        <button
          type="button"
          onClick={() => {
            setShowGuestNewChatModal(false)
            setAuthMode('login')
            setAuthMessage('')
            setShowAuthModal(true)
          }}
          style={{
            flex: 1,
            padding: '12px',
            border: 'none',
            background: '#4f46e5',
            color: '#fff',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Log in
        </button>

      </div>

    </div>

  </div>
)}


      {/* Login / Sign Up Modal */}

      {showAuthModal && (

        <div
          onClick={() => setShowAuthModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}
        >

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '420px',
              background: '#ffffff',
              borderRadius: '16px',
              padding: '30px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
              position: 'relative',
              boxSizing: 'border-box'
            }}
          >

            {/* Close Button */}

            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '18px',
                border: 'none',
                background: 'transparent',
                fontSize: '24px',
                color: '#666',
                cursor: 'pointer'
              }}
            >
              ×
            </button>

            {/* Heading */}

            <h2 style={{
              textAlign: 'center',
              marginBottom: '8px',
              color: '#222'
            }}>
              {authMode === 'login' ? 'Welcome Back!' : 'Create Account'}
            </h2>

            <p style={{
              textAlign: 'center',
              color: '#777',
              fontSize: '14px',
              marginBottom: '25px'
            }}>
              {authMode === 'login'
                ? 'Login to your account'
                : 'Create your account to get started'}
            </p>

            {/* Authentication Form */}

            <form onSubmit={handleAuthSubmit}>

              {authMode === 'register' && (

                <div style={{ marginBottom: '16px' }}>

                  <label style={{
                    display: 'block',
                    marginBottom: '7px',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    Full Name
                  </label>

                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '15px',
                      boxSizing: 'border-box'
                    }}
                  />

                </div>

              )}

              <div style={{ marginBottom: '16px' }}>

                <label style={{
                  display: 'block',
                  marginBottom: '7px',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  Email Address
                </label>

                <input
                  type="email"
                  placeholder="Enter your email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                />

              </div>

              <div style={{ marginBottom: '18px' }}>

                <label style={{
                  display: 'block',
                  marginBottom: '7px',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  Password
                </label>

                <input
                  type="password"
                  placeholder="Enter your password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                  minLength={8}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                />

              </div>

              {/* Success / Error Message */}

              {authMessage && (

                <p style={{
                  color: authMessage.includes('successfully')
                    ? '#16a34a'
                    : '#dc2626',
                  fontSize: '13px',
                  marginBottom: '15px',
                  textAlign: 'center'
                }}>
                  {authMessage}
                </p>

              )}

              {/* Submit Button */}

              <button
                type="submit"
                disabled={authLoading}
                style={{
                  width: '100%',
                  padding: '13px',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#4f46e5',
                  color: 'white',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: authLoading ? 'not-allowed' : 'pointer',
                  opacity: authLoading ? 0.7 : 1
                }}
              >
                {authLoading
                  ? 'Please wait...'
                  : authMode === 'login'
                    ? 'Login'
                    : 'Create Account'}
              </button>

            </form>

            {/* Switch Login / Register */}

            <p style={{
              textAlign: 'center',
              marginTop: '20px',
              fontSize: '14px',
              color: '#666'
            }}>

              {authMode === 'login'
                ? "Don't have an account? "
                : 'Already have an account? '}

              <button
                type="button"
                onClick={() => {
                  setAuthMode(
                    authMode === 'login' ? 'register' : 'login'
                  )
                  setAuthMessage('')
                  setAuthPassword('')
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#4f46e5',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {authMode === 'login' ? 'Sign Up' : 'Login'}
              </button>

            </p>

          </div>

        </div>

      )}

      {/* Delete All Confirmation Modal */}

      {showDeleteAllModal && (

        <div
          onClick={() => setShowDeleteAllModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: '20px'
          }}
        >

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '400px',
              background: '#ffffff',
              borderRadius: '14px',
              padding: '25px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
              textAlign: 'center'
            }}
          >

            <div style={{
              fontSize: '35px',
              marginBottom: '12px'
            }}>
              🗑️
            </div>

            <h2 style={{
              fontSize: '20px',
              color: '#222',
              marginBottom: '12px'
            }}>
              Delete All Chats?
            </h2>

            <p style={{
              color: '#666',
              fontSize: '14px',
              lineHeight: '1.6',
              marginBottom: '25px'
            }}>
              Are you sure you want to delete all chats? This action cannot be undone.
            </p>

            <div style={{
              display: 'flex',
              gap: '12px'
            }}>

              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f3f4f6',
                  color: '#333',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={async () => {
  await handleDeleteAllChats()
  setShowDeleteAllModal(false)
}}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Delete All
              </button>

            </div>

          </div>

        </div>

      )}


    </div>

  )

}

// Common Dropdown Button Style
const menuButtonStyle = {
  display: 'block',
  width: '100%',
  padding: '10px',
  border: 'none',
  background: 'transparent',
  textAlign: 'left',
  cursor: 'pointer',
  borderRadius: '6px',
  fontSize: '14px',
  color: '#333'
}

export default App
