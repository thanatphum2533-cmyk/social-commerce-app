'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

export default function Home() {
  // --- ระบบ Login ของจริง ---
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // เช็กว่าเคยล็อกอินไว้ไหมใน localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('crm_user');
    if (savedUser) {
      setLoggedInUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLoggedInUser(data.user);
        localStorage.setItem('crm_user', JSON.stringify(data.user)); // จำการล็อกอิน
      } else {
        setLoginError(data.error);
      }
    } catch (err) {
      setLoginError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    localStorage.removeItem('crm_user');
  };

  const handleExportCSV = () => {
    const rows = [
      ["รหัสลูกค้า/ชื่อ", "เบอร์โทรศัพท์", "ที่อยู่จัดส่ง", "สถานะการชำระเงิน", "วันที่อัปเดต", "ติดดาว", "แท็ก (Tags)"]
    ];
    
    Object.keys(customersInfo).forEach(id => {
      const info = customersInfo[id];
      if (!info.address) return;

      // หาวันที่อัปเดต หรือใช้วันที่ของข้อความล่าสุด
      let dateObj = info.updatedAt ? new Date(info.updatedAt) : null;
      if (!dateObj) {
         const lastMsg = [...messages].reverse().find(m => m.senderId === id);
         dateObj = lastMsg && lastMsg.timestamp ? new Date(lastMsg.timestamp) : new Date();
      }
      
      const infoDateStr = dateObj.toISOString().slice(0, 10);
      
      // Filter by Date
      if (exportStartDate && infoDateStr < exportStartDate) return;
      if (exportEndDate && infoDateStr > exportEndDate) return;

      const name = [...messages].reverse().find(m => m.senderId === id && m.senderName)?.senderName || id;
      rows.push([
        `"${name}"`,
        `="${info.phone || '-'}"`,
        `"${info.address.replace(/\n/g, ' ')}"`,
        info.status || 'รอโอนเงิน',
        infoDateStr,
        info.isStarred ? '⭐ ใช่' : '-',
        `"${(info.tags || []).join(', ')}"`
      ]);
    });

    const csvContent = "\uFEFF" + rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ที่อยู่จัดส่ง_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportReports = (type: string) => {
    let rows: string[][] = [];
    let filename = "";

    if (type === 'sales') {
      rows = [["รหัสออเดอร์", "ลูกค้า", "แอดมิน", "ยอดรวม (บาท)", "สถานะ", "วันที่"]];
      orders.forEach(o => {
        const orderDateStr = o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : "";
        if (exportStartDate && orderDateStr < exportStartDate) return;
        if (exportEndDate && orderDateStr > exportEndDate) return;
        rows.push([o.id, `"${o.customerName}"`, o.adminName || 'ระบบ', o.total.toString(), o.status, orderDateStr]);
      });
      filename = `ยอดขาย_${new Date().toISOString().slice(0,10)}`;
    } else if (type === 'kpi') {
      rows = [["ชื่อแอดมิน", "ตอบแชท (ครั้ง)", "ปิดการขาย (บิล)", "ยอดขายรวม (บาท)"]];
      adminStats.forEach(stat => {
        rows.push([`"${stat.name}"`, stat.replies.toString(), stat.ordersCount.toString(), stat.sales.toString()]);
      });
      filename = `ผลงานแอดมิน_${new Date().toISOString().slice(0,10)}`;
    } else if (type === 'inventory') {
      rows = [["รหัสสินค้า", "ชื่อสินค้า", "ราคา (บาท)", "คงเหลือ"]];
      products.forEach(p => {
        rows.push([p.id, `"${p.name}"`, p.price.toString(), p.stock.toString()]);
      });
      filename = `สต็อกสินค้า_${new Date().toISOString().slice(0,10)}`;
    }

    const csvContent = "\uFEFF" + rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- States ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chats' | 'products' | 'analytics' | 'customers' | 'settings'>('dashboard');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [systemUsers, setSystemUsers] = useState<any>({});
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: 'staff' });
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [orderStatus, setOrderStatus] = useState<'รอโอนเงิน' | 'รอตรวจสอบสลิป' | 'โอนแล้ว' | 'จัดส่งแล้ว'>('รอโอนเงิน');

  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [billItems, setBillItems] = useState<any[]>([]);
  const [shippingFee, setShippingFee] = useState(0);

  // --- ข้อมูลที่อยู่ลูกค้าและการพิมพ์ลาเบล ---
  const [customersInfo, setCustomersInfo] = useState<Record<string, any>>({});
  const [isPrintingLabel, setIsPrintingLabel] = useState(false);
  const [onlineAdmins, setOnlineAdmins] = useState<string[]>([]);
  
  // --- ระบบตั้งค่าเพจ ---
  const [appConfig, setAppConfig] = useState<any>({ pageName: '', accessToken: '', shopName: '', shopAddress: '', shopPhone: '', shippingOptions: [] });
  const [fbPages, setFbPages] = useState<any[]>([]);
  const [isFbModalOpen, setIsFbModalOpen] = useState(false);
  const [isLoadingFb, setIsLoadingFb] = useState(false);
  const [isSyncingMessages, setIsSyncingMessages] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedCourier, setSelectedCourier] = useState('flash');

  // ดึงข้อความและข้อมูลอัตโนมัติทุก 1 วินาที (Background Auto-Refresh)
  useEffect(() => {
    if (!loggedInUser) return;

    const fetchMessages = () => {
      fetch('/api/messages?t=' + Date.now(), { cache: 'no-store' })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setMessages(data);
          }
        })
        .catch(e => console.error(e));
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 1000);
    return () => clearInterval(interval);
  }, [loggedInUser]);

  // --- Fetch Data อื่นๆ ตอนเปิดเว็บ ---
  useEffect(() => {
    // โหลด Facebook SDK
    (window as any).fbAsyncInit = function() {
      (window as any).FB.init({
        appId      : '1055585047522758', // ของร้าน Arisa Jewelry
        cookie     : true,
        xfbml      : true,
        version    : 'v18.0'
      });
    };
    (function(d, s, id){
       var js: any, fjs = d.getElementsByTagName(s)[0];
       if (d.getElementById(id)) {return;}
       js = d.createElement(s); js.id = id;
       js.src = "https://connect.facebook.net/en_US/sdk.js";
       fjs.parentNode?.insertBefore(js, fjs);
     }(document, 'script', 'facebook-jssdk'));

    if (!loggedInUser) return;

    const fetchProducts = () => {
      fetch('/api/products').then(r => r.json()).then(setProducts).catch(e => console.error(e));
    };
    const fetchOrders = () => {
      fetch('/api/orders').then(r => r.json()).then(setOrders).catch(e => console.error(e));
    };
    const fetchCustomersInfo = () => {
      fetch('/api/customers_info').then(r => r.json()).then(setCustomersInfo).catch(e => console.error(e));
    };
    const fetchConfig = () => {
      fetch('/api/config').then(r => r.json()).then(setAppConfig).catch(e => console.error(e));
    };
    const pingAndFetchOnline = () => {
      fetch('/api/admins/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminName: loggedInUser.name })
      })
      .then(() => fetch('/api/admins/ping'))
      .then(r => r.json())
      .then(data => setOnlineAdmins(data.online || []))
      .catch(e => console.error(e));
    };
    const fetchUsers = () => {
      if (loggedInUser.role === 'admin') {
        fetch('/api/users').then(r => r.json()).then(setSystemUsers).catch(e => console.error(e));
      }
    };

    fetchProducts();
    fetchOrders();
    fetchCustomersInfo();
    fetchConfig();
    pingAndFetchOnline();
    fetchUsers();

    const pingInterval = setInterval(pingAndFetchOnline, 5000);
    return () => clearInterval(pingInterval);
  }, [loggedInUser]);

  // ฟังก์ชันสุ่มสีและตัวอักษร Avatar สำหรับลูกค้าแต่ละคน
  const getAvatarForCustomer = (name: string, id: string) => {
    const colors = [
      'bg-blue-500 text-white',
      'bg-indigo-500 text-white',
      'bg-purple-500 text-white',
      'bg-pink-500 text-white',
      'bg-rose-500 text-white',
      'bg-amber-500 text-white',
      'bg-emerald-500 text-white',
      'bg-teal-500 text-white',
      'bg-cyan-500 text-white',
    ];
    let hash = 0;
    for (let i = 0; i < (id || name || '').length; i++) {
      hash = (id || name).charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorClass = colors[Math.abs(hash) % colors.length];
    const initial = (name || 'L').trim().charAt(0).toUpperCase();
    return { colorClass, initial };
  };

  // รายชื่อลูกค้าทั้งหมดที่แยกตามคน (Inbox Group by Customer)
  const conversationList = useMemo(() => {
    const map = new Map<string, any>();
    
    // เรียงข้อความตามเวลา
    messages.forEach(msg => {
      // ลูกค้าคือ senderId ถ้าเป็นฝั่งลูกค้า หรือ recipientId ถ้าเป็นฝั่งร้านส่งหา
      const customerId = msg.isCustomer ? msg.senderId : msg.recipientId;
      if (!customerId || customerId === 'ME') return;

      const existing = map.get(customerId) || {
        customerId,
        senderName: msg.senderName || customersInfo[customerId]?.name || `ลูกค้า (${customerId.slice(-4)})`,
        senderAvatar: msg.senderAvatar || null,
        lastMessage: msg.text || (msg.imageUrl ? 'ส่งรูปภาพ' : ''),
        lastTime: msg.time,
        timestamp: msg.timestamp || (typeof msg.id === 'number' ? msg.id : 0),
        unread: false
      };

      if (msg.senderName) existing.senderName = msg.senderName;
      if (msg.senderAvatar) existing.senderAvatar = msg.senderAvatar;
      existing.lastMessage = msg.text || (msg.imageUrl ? 'ส่งรูปภาพ' : '');
      existing.lastTime = msg.time;
      existing.timestamp = msg.timestamp || (typeof msg.id === 'number' ? msg.id : 0);

      map.set(customerId, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [messages, customersInfo]);

  // กำหนด active customer อัตโนมัติถ้ายังไม่ได้เลือก
  const activeCustomerId = selectedCustomerId || (conversationList.length > 0 ? conversationList[0].customerId : '');

  // กรองเฉพาะข้อความของลูกค้าที่เลือกอยู่
  const activeConversationMessages = useMemo(() => {
    if (!activeCustomerId) return messages;
    return messages.filter(m => (m.senderId === activeCustomerId) || (m.recipientId === activeCustomerId));
  }, [messages, activeCustomerId]);

  const activeCustomerInfo = useMemo(() => {
    return conversationList.find(c => c.customerId === activeCustomerId) || {
      customerId: activeCustomerId,
      senderName: 'ลูกค้า Facebook',
      senderAvatar: null
    };
  }, [conversationList, activeCustomerId]);

  // ซิงค์ orderStatus กับลูกค้าที่เลือกอยู่
  useEffect(() => {
    if (activeCustomerId && customersInfo[activeCustomerId]?.status) {
      setOrderStatus(customersInfo[activeCustomerId].status);
    } else {
      setOrderStatus('รอโอนเงิน');
    }
  }, [activeCustomerId, customersInfo]);

  // --- Functions ---
  const handleFBLogin = () => {
    // ใช้วิธี Redirect OAuth โดยตรง ไม่ต้องพึ่งพา JSSDK ทำให้ไม่ต้องคอยแก้ Allowed Domains ใน Facebook ทุกครั้ง
    const clientId = appConfig.appId || '1055585047522758';
    const redirectUri = window.location.origin + '/api/auth/facebook/callback';
    const scope = 'pages_messaging,pages_show_list,pages_manage_metadata,pages_read_engagement';
    const oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;
    window.location.href = oauthUrl;
  };

  const handleSyncOldMessages = async () => {
    setIsSyncingMessages(true);
    try {
      const res = await fetch('/api/sync_messages', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`✅ ซิงค์สำเร็จ!\nดึงข้อความเก่าเข้ามาเพิ่มได้ ${data.importedCount} ข้อความ\n(จากทั้งหมด ${data.totalConversations} การสนทนา)`);
        fetch('/api/messages').then(r => r.json()).then(setMessages);
        fetch('/api/customers_info').then(r => r.json()).then(setCustomersInfo);
      } else {
        alert('❌ ซิงค์ไม่สำเร็จ: ' + (data.error || 'กรุณาลองใหม่อีกครั้ง'));
      }
    } catch (err: any) {
      alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsSyncingMessages(false);
    }
  };

  const handleSelectPageToConnect = async (page: any) => {
    setIsLoadingFb(true);
    try {
      const res = await fetch('/api/fb_subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: page.id, pageAccessToken: page.access_token, pageName: page.name })
      });
      const data = await res.json();
      if (data.success) {
        alert('เชื่อมต่อและผูก Webhook เข้ากับเพจ ' + page.name + ' อัตโนมัติสำเร็จ!');
        setAppConfig((prev: any) => ({...prev, pageName: page.name, accessToken: page.access_token}));
        setIsFbModalOpen(false);
      } else {
        alert('เกิดข้อผิดพลาด: ' + data.error);
      }
    } catch (e) {
      alert('เชื่อมต่อไม่สำเร็จ');
    }
    setIsLoadingFb(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return alert('กรุณากรอก Username และ Password');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CREATE', ...newUser })
    });
    const data = await res.json();
    if (res.ok) {
      setSystemUsers(data.users);
      setNewUser({ username: '', password: '', name: '', role: 'staff' });
      alert('สร้างผู้ใช้สำเร็จ');
    } else {
      alert(data.error);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('ยืนยันการลบผู้ใช้?')) return;
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DELETE', id })
    });
    const data = await res.json();
    if (res.ok) {
      setSystemUsers(data.users);
    } else {
      alert(data.error);
    }
  };

  const handleSaveCustomerInfo = async (customerId: string, phone: string, address: string, status?: string, isStarred?: boolean, tags?: string[]) => {
    // อัปเดต UI ทันที
    setCustomersInfo(prev => {
      const prevInfo = prev[customerId] || {};
      return {
        ...prev,
        [customerId]: { 
          ...prevInfo, 
          phone, 
          address, 
          status: status !== undefined ? status : prevInfo.status,
          isStarred: isStarred !== undefined ? isStarred : prevInfo.isStarred,
          tags: tags !== undefined ? tags : prevInfo.tags
        }
      };
    });
    // บันทึกลงเซิร์ฟเวอร์
    await fetch('/api/customers_info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, phone, address, status, isStarred, tags })
    });
  };

  const handleToggleStar = (customerId: string) => {
    const currentInfo = customersInfo[customerId] || { phone: '', address: '' };
    handleSaveCustomerInfo(customerId, currentInfo.phone, currentInfo.address, undefined, !currentInfo.isStarred, currentInfo.tags);
  };

  const handleAddTag = (customerId: string, tag: string) => {
    if (!tag.trim()) return;
    const currentInfo = customersInfo[customerId] || { phone: '', address: '' };
    const tags = currentInfo.tags || [];
    if (!tags.includes(tag)) {
      handleSaveCustomerInfo(customerId, currentInfo.phone, currentInfo.address, undefined, currentInfo.isStarred, [...tags, tag]);
    }
  };

  const handleRemoveTag = (customerId: string, tag: string) => {
    const currentInfo = customersInfo[customerId] || { phone: '', address: '' };
    const tags = currentInfo.tags || [];
    handleSaveCustomerInfo(customerId, currentInfo.phone, currentInfo.address, undefined, currentInfo.isStarred, tags.filter((t: string) => t !== tag));
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  const handleQuickReply = (text: string) => {
    setReplyText(prev => prev ? `${prev} ${text}` : text);
  };

  const handleAddProductToBill = (product: any) => {
    const existing = billItems.find(item => item.id === product.id);
    if (existing) {
      setBillItems(billItems.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setBillItems([...billItems, { ...product, qty: 1 }]);
    }
  };

  useEffect(() => {
    const totalWeight = billItems.reduce((sum, item) => sum + ((item.weight || 0) * item.qty), 0);
    const courierConfig = appConfig.shippingOptions?.find((o: any) => o.id === selectedCourier) || { baseRate: 40, addRate: 10 };
    
    if (totalWeight > 0) {
      const fee = courierConfig.baseRate + Math.max(0, Math.ceil((totalWeight - 1000) / 1000)) * courierConfig.addRate;
      setShippingFee(fee);
    } else if (billItems.length === 0) {
      setShippingFee(0);
    }
  }, [billItems, selectedCourier, appConfig.shippingOptions]);

  const calculateTotal = () => {
    const itemsTotal = billItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
    return itemsTotal + shippingFee;
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || isSending || !loggedInUser) return;

    const recipientId = activeCustomerId;
    if (!recipientId) return alert("กรุณาเลือกลูกค้าที่ต้องการตอบกลับครับ");

    setIsSending(true);
    try {
      const res = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: recipientId, text: replyText, adminName: loggedInUser.name })
      });
      if (res.ok) {
        setReplyText('');
        fetch('/api/messages', { cache: 'no-store' }).then(r => r.json()).then(setMessages);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendBill = async () => {
    const lastCustomerMsg = [...messages].reverse().find(m => m.isCustomer && m.senderId);
    if (!lastCustomerMsg) return alert("ไม่มีลูกค้าให้ส่งบิลครับ");
    if (billItems.length === 0) return alert("กรุณาเลือกสินค้าอย่างน้อย 1 ชิ้นครับ");

    let billText = `🧾 สรุปยอดสั่งซื้อ\n`;
    billText += `----------------------\n`;
    billItems.forEach(item => {
      billText += `• ${item.name} (x${item.qty}) = ${item.price * item.qty} ฿\n`;
    });
    billText += `----------------------\n`;
    billText += `ค่าจัดส่ง: ${shippingFee} ฿\n`;
    billText += `💰 ยอดโอนรวมทั้งสิ้น: ${calculateTotal()} ฿\n\n`;
    billText += `🏦 ธนาคารกสิกรไทย\nเลขที่บัญชี: 123-4-56789-0\nชื่อบัญชี: บจก. อริสา จิวเวลรี่\n\nโอนแล้วรบกวนแนบสลิปพร้อมแจ้งที่อยู่จัดส่งได้เลยนะครับ ขอบคุณครับ 🙏`;

    setIsSending(true);
    try {
      // 1. ส่งแชท
      const res = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: lastCustomerMsg.senderId, text: billText, adminName: loggedInUser.name })
      });
      if (res.ok) {
        // 2. บันทึกออเดอร์ลงฐานข้อมูล
        await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: lastCustomerMsg.senderName || 'ลูกค้าจาก Facebook',
            customerId: lastCustomerMsg.senderId,
            items: billItems,
            shippingFee: shippingFee,
            courier: selectedCourier,
            total: calculateTotal(),
            status: 'รอโอนเงิน',
            adminName: loggedInUser.name
          })
        });
        
        setIsBillModalOpen(false);
        setBillItems([]);
        setShippingFee(0);
        
        // รีเฟรชข้อมูลแชทและออเดอร์
        fetch('/api/messages', { cache: 'no-store' }).then(r => r.json()).then(setMessages);
        fetch('/api/orders').then(r => r.json()).then(setOrders);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const [newProdId, setNewProdId] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdStock, setNewProdStock] = useState('');
  const [newProdImage, setNewProdImage] = useState('');
  const [newProdWeight, setNewProdWeight] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 600;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setNewProdImage(compressedDataUrl);
        setIsUploadingImage(false);
      };
      img.onerror = () => setIsUploadingImage(false);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => setIsUploadingImage(false);
    reader.readAsDataURL(file);
  };

  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);

  const handleAddProductDB = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdPrice) return;
    setIsSubmittingProduct(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: newProdId.trim() || undefined,
          name: newProdName.trim(), 
          price: Number(newProdPrice), 
          stock: Number(newProdStock) || 0, 
          image: newProdImage, 
          weight: Number(newProdWeight) || 0 
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewProdId(''); setNewProdName(''); setNewProdPrice(''); setNewProdStock(''); setNewProdImage(''); setNewProdWeight('');
        fetch('/api/products').then(r => r.json()).then(setProducts);
      } else {
        alert('ไม่สามารถเพิ่มสินค้าได้: ' + (data.error || 'กรุณาลองใหม่อีกครั้ง'));
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + err.message);
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  const handleDeleteProductDB = async (id: string) => {
    if (!confirm('ยืนยันการลบสินค้านี้?')) return;
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        fetch('/api/products').then(r => r.json()).then(setProducts);
      } else {
        alert('ไม่สามารถลบสินค้าได้: ' + (data.error || 'กรุณาลองใหม่อีกครั้ง'));
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + err.message);
    }
  };


  // --- Profile Menu State ---
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // --- คำนวณสถิติแอดมิน ---
  const adminStats = useMemo(() => {
    const stats: Record<string, { sales: number, replies: number, ordersCount: number }> = {};
    
    // นับจำนวนแชทที่ตอบ
    messages.forEach(msg => {
      if (!msg.isCustomer && msg.repliedBy) {
         if (!stats[msg.repliedBy]) stats[msg.repliedBy] = { sales: 0, replies: 0, ordersCount: 0 };
         stats[msg.repliedBy].replies += 1;
      }
    });

    // นับยอดขายและจำนวนบิล
    orders.forEach(order => {
       const admin = order.adminName || 'ระบบอัตโนมัติ';
       if (!stats[admin]) stats[admin] = { sales: 0, replies: 0, ordersCount: 0 };
       stats[admin].sales += (order.total || 0);
       stats[admin].ordersCount += 1;
    });

    return Object.entries(stats).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.sales - a.sales);
  }, [messages, orders]);


  // --- หน้าจอ Login ---
  if (!loggedInUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 font-sans">
        {/* ... Login Screen (unchanged) ... */}
        <div className="bg-white w-96 p-8 rounded-2xl shadow-xl flex flex-col items-center">
          <div className="w-16 h-16 bg-[#312e81] text-white rounded-2xl flex items-center justify-center font-black text-4xl mb-4 shadow-lg">
            <i className="fa-solid fa-bolt"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Social Commerce</h1>
          <p className="text-sm text-gray-500 mb-8">กรุณาเข้าสู่ระบบเพื่อจัดการร้านค้า</p>
          
          <div className="w-full flex flex-col gap-4" onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(e as any); }}>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Username</label>
              <input 
                type="text" 
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4f46e5] transition-all" 
                placeholder="ชื่อผู้ใช้"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Password</label>
              <input 
                type="text" 
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4f46e5] transition-all" 
                placeholder="รหัสผ่าน"
              />
            </div>
            
            {loginError && <p className="text-xs text-red-500 font-bold bg-red-50 p-2 rounded-md border border-red-100 text-center">{loginError}</p>}
            
            <button 
              type="button" 
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full bg-[#4f46e5] text-white font-bold py-3 rounded-lg hover:bg-indigo-600 transition-all mt-2 shadow-md flex justify-center items-center gap-2"
            >
              {isLoggingIn ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-right-to-bracket"></i>}
              เข้าสู่ระบบ
            </button>
          </div>
        </div>
      </div>
    );
  }


  // --- หน้าจอหลัก (Dashboard) ---
  return (
    <div className="flex h-screen bg-[#f3f4f6] font-sans overflow-hidden text-sm">
      
      {/* 1. แถบเมนูซ้ายสุด */}
      <div className="w-[68px] bg-[#312e81] flex flex-col items-center py-4 text-white shrink-0 z-20 relative">
        <div 
          onClick={() => setActiveTab('dashboard')}
          className={`w-11 h-11 bg-white text-[#312e81] rounded-xl flex items-center justify-center font-black text-2xl mb-8 shadow-sm cursor-pointer hover:bg-gray-100 transition-colors ${activeTab === 'dashboard' ? 'ring-4 ring-indigo-400/50' : ''}`}
        >
          <i className="fa-solid fa-bolt"></i>
        </div>
        
        <div 
          onClick={() => setActiveTab('chats')}
          className={`w-full py-4 flex justify-center cursor-pointer text-xl transition-all ${activeTab === 'chats' ? 'border-l-4 border-white bg-white/10 opacity-100' : 'opacity-50 hover:bg-white/5'}`}
        >
          <i className="fa-solid fa-message"></i>
        </div>
        
        <div 
          onClick={() => setActiveTab('products')}
          className={`w-full py-4 flex justify-center cursor-pointer text-xl transition-all ${activeTab === 'products' ? 'border-l-4 border-white bg-white/10 opacity-100' : 'opacity-50 hover:bg-white/5'}`}
        >
          <i className="fa-solid fa-box-open"></i>
        </div>
        
        <div 
          onClick={() => setActiveTab('analytics')}
          className={`w-full py-4 flex justify-center cursor-pointer text-xl transition-all ${activeTab === 'analytics' ? 'border-l-4 border-white bg-white/10 opacity-100' : 'opacity-50 hover:bg-white/5'}`}
        >
          <i className="fa-solid fa-chart-pie"></i>
        </div>
        
        <div 
          onClick={() => setActiveTab('customers')}
          className={`w-full py-4 flex justify-center cursor-pointer text-xl transition-all ${activeTab === 'customers' ? 'border-l-4 border-white bg-white/10 opacity-100' : 'opacity-50 hover:bg-white/5'}`}
        >
          <i className="fa-solid fa-users"></i>
        </div>
        
        {/* เมนู 3 ขีด (Hamburger Menu) ด้านล่างสุด */}
        <div className="mt-auto relative w-full flex justify-center">
          <div 
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer text-xl transition-all ${isProfileMenuOpen ? 'bg-white text-[#312e81]' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            <i className="fa-solid fa-bars"></i>
          </div>

          {/* Popup Dropdown */}
          {isProfileMenuOpen && (
            <div className="absolute bottom-12 left-14 w-60 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 text-gray-800 overflow-hidden transform origin-bottom-left transition-all">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <p className="font-bold text-sm text-gray-900">{loggedInUser.name}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-0.5">{loggedInUser.role === 'admin' ? 'Super Admin' : 'Staff'}</p>
              </div>
              
              {loggedInUser.role === 'admin' && (
                <button 
                  onClick={() => { setActiveTab('settings'); setIsProfileMenuOpen(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm font-medium flex items-center gap-3 transition-colors"
                >
                  <i className="fa-solid fa-gear text-gray-400 w-4"></i> ตั้งค่าระบบ
                </button>
              )}
              
              {loggedInUser.role === 'admin' && <div className="h-[1px] bg-gray-100 my-1"></div>}
              
              <button 
                onClick={handleLogout}
                className="w-full text-left px-4 py-3 hover:bg-red-50 text-red-600 text-sm font-bold flex items-center gap-3 transition-colors"
              >
                <i className="fa-solid fa-arrow-right-from-bracket w-4"></i> ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --- TAB แดชบอร์ด (Dashboard) --- */}
      {activeTab === 'dashboard' && (
        <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">ภาพรวมระบบ (Dashboard)</h1>
                <p className="text-gray-500">ยินดีต้อนรับกลับมา, {loggedInUser?.name} 👋</p>
              </div>
              <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-end">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">ทีมงานที่สแตนด์บายตอนนี้</p>
                <div className="flex -space-x-3">
                  {onlineAdmins.map((name, i) => (
                    <div key={i} className="relative group cursor-pointer">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-sm border-2 border-white shadow-sm ${name.includes('บอย') ? 'bg-indigo-500' : 'bg-pink-500'}`}>
                        {name.charAt(0)}
                      </div>
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-10">
                        {name} ออนไลน์
                      </div>
                    </div>
                  ))}
                  {onlineAdmins.length === 0 && (
                    <p className="text-xs text-red-500 font-bold">ไม่มีแอดมินออนไลน์ ❌</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end items-end gap-3 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">ตั้งแต่วันที่</label>
                <input type="date" className="border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">ถึงวันที่</label>
                <input type="date" className="border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} />
              </div>
              <button 
                onClick={handleExportCSV}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-lg shadow-sm flex items-center gap-2 transition-colors border border-green-700 h-[38px]"
              >
                <i className="fa-solid fa-file-excel"></i> ดาวน์โหลดที่อยู่ (Excel)
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-2xl">
                  <i className="fa-solid fa-message"></i>
                </div>
                <div>
                  <p className="text-gray-500 text-sm font-bold mb-1">ข้อความทั้งหมด</p>
                  <p className="text-3xl font-black text-gray-800">{messages.length}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-2xl">
                  <i className="fa-solid fa-box"></i>
                </div>
                <div>
                  <p className="text-gray-500 text-sm font-bold mb-1">สินค้าในคลัง</p>
                  <p className="text-3xl font-black text-gray-800">{products.length}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-2xl">
                  <i className="fa-solid fa-sack-dollar"></i>
                </div>
                <div>
                  <p className="text-gray-500 text-sm font-bold mb-1">ยอดขายสะสม (รวม)</p>
                  <p className="text-3xl font-black text-gray-800">{orders.reduce((sum, order) => sum + (order.total || 0), 0).toLocaleString()} ฿</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center text-gray-400 py-16">
              <i className="fa-solid fa-chart-line text-6xl mb-4 text-gray-200"></i>
              <p className="font-bold text-lg text-gray-600">กดไปที่แท็บ สถิติ (วงกลม) เพื่อดูรายงานยอดขายแบบละเอียดครับ</p>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB สถิติและรายงาน (Analytics) --- */}
      {activeTab === 'analytics' && (
        <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <i className="fa-solid fa-chart-pie text-[#4f46e5]"></i> สถิติยอดขายและรายงาน (Analytics & Reports)
              </h1>
            </div>

            {/* --- ศูนย์รวมรีพอร์ต (Export Hub) --- */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <i className="fa-solid fa-download text-[#10b981]"></i> ส่งออกรายงาน (Export to Excel/CSV)
              </h3>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">ตั้งแต่วันที่</label>
                  <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4f46e5]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">ถึงวันที่</label>
                  <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4f46e5]" />
                </div>
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => handleExportReports('sales')} className="bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg font-bold text-xs hover:bg-blue-100 transition-colors flex items-center gap-2">
                    <i className="fa-solid fa-file-invoice-dollar"></i> ยอดขาย (Orders)
                  </button>
                  <button onClick={() => handleExportReports('kpi')} className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg font-bold text-xs hover:bg-indigo-100 transition-colors flex items-center gap-2">
                    <i className="fa-solid fa-user-tie"></i> ผลงานแอดมิน (KPI)
                  </button>
                  <button onClick={() => handleExportReports('inventory')} className="bg-orange-50 text-orange-600 border border-orange-200 px-4 py-2 rounded-lg font-bold text-xs hover:bg-orange-100 transition-colors flex items-center gap-2">
                    <i className="fa-solid fa-boxes-stacked"></i> สต็อกสินค้า (Inventory)
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">ออเดอร์ทั้งหมด ({orders.length} รายการ)</h3>
                <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                  {orders.map((o, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div>
                        <p className="font-bold text-sm text-gray-800">{o.id}</p>
                        <p className="text-[10px] text-gray-500">ลูกค้า: {o.customerName} • แอดมิน: {o.adminName || 'ระบบ'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-[#10b981]">{o.total?.toLocaleString()} ฿</p>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${o.status === 'รอโอนเงิน' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                          {o.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-center items-center">
                <div className="relative w-48 h-48 rounded-full border-8 border-gray-100 flex items-center justify-center shadow-inner" style={{ borderTopColor: '#4f46e5', borderRightColor: '#4f46e5', transform: 'rotate(-45deg)' }}>
                  <div style={{ transform: 'rotate(45deg)' }} className="text-center">
                    <p className="text-gray-500 text-xs font-bold mb-1">ยอดขายรวม</p>
                    <p className="text-2xl font-black text-gray-800">{orders.reduce((sum, order) => sum + (order.total || 0), 0).toLocaleString()} ฿</p>
                  </div>
                </div>
                <div className="mt-8 flex gap-4 text-xs font-bold text-gray-600">
                  <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#4f46e5]"></span> โอนแล้ว</div>
                  <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-200"></span> รอโอน</div>
                </div>
              </div>
            </div>

            {/* --- ตารางผลงานแอดมิน (Admin Performance KPI) --- */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-indigo-50 border-b border-indigo-100 p-4">
                <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                  <i className="fa-solid fa-ranking-star"></i> ตารางวัดผลแอดมิน (Admin Performance KPI)
                </h3>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="p-4 font-bold">ชื่อแอดมิน</th>
                    <th className="p-4 font-bold text-center">ตอบแชท (ครั้ง)</th>
                    <th className="p-4 font-bold text-center">ปิดการขาย (บิล)</th>
                    <th className="p-4 font-bold text-right">ยอดขายรวม (บาท)</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {adminStats.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-400 font-bold">ยังไม่มีข้อมูลการขาย</td>
                    </tr>
                  ) : (
                    adminStats.map((stat, idx) => (
                      <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-bold text-gray-800 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-white ${idx === 0 ? 'bg-yellow-400 shadow-sm' : idx === 1 ? 'bg-gray-400' : 'bg-indigo-300'}`}>
                            {idx + 1}
                          </div>
                          {stat.name}
                        </td>
                        <td className="p-4 text-center font-bold text-gray-600">{stat.replies}</td>
                        <td className="p-4 text-center font-bold text-gray-600">{stat.ordersCount}</td>
                        <td className="p-4 text-right font-black text-emerald-600">{stat.sales.toLocaleString()} ฿</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {activeTab === 'chats' && (
        <>
          {/* 2. รายการแชท (Inbox List) รองรับหลายคน */}
          <div className="w-[320px] bg-white border-r border-gray-200 flex flex-col shrink-0 z-10">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-800">ข้อความ (Inbox)</h2>
                <p className="text-[11px] text-gray-500 font-medium">{conversationList.length} ลูกค้า</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSyncOldMessages}
                  disabled={isSyncingMessages}
                  title="ซิงค์แชทเก่าทั้งหมดจากเพจ"
                  className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <i className={`fa-solid fa-arrows-rotate ${isSyncingMessages ? 'fa-spin text-indigo-600' : ''}`}></i>
                  <span>{isSyncingMessages ? 'กำลังซิงค์...' : 'ซิงค์แชทเก่า'}</span>
                </button>
              </div>
            </div>
            
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <i className="fa-solid fa-search absolute left-3 top-2.5 text-gray-400"></i>
                <input type="text" placeholder="ค้นหาชื่อลูกค้า, ข้อความ..." className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {conversationList.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-xs">
                  <i className="fa-solid fa-comments text-3xl mb-2 text-gray-300"></i>
                  <p>ยังไม่มีบทสนทนา</p>
                  <p className="text-[10px] text-gray-400 mt-1">กด "ซิงค์แชทเก่า" หรือรอลูกค้าทักมา</p>
                </div>
              ) : (
                conversationList.map((conv) => {
                  const isSelected = conv.customerId === activeCustomerId;
                  const cInfo = customersInfo[conv.customerId];
                  return (
                    <div 
                      key={conv.customerId}
                      onClick={() => setSelectedCustomerId(conv.customerId)}
                      className={`flex p-3 cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-indigo-50/70 border-l-4 border-[#4f46e5]' 
                          : 'hover:bg-gray-50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="relative shrink-0">
                        {conv.senderAvatar ? (
                          <img 
                            src={conv.senderAvatar} 
                            alt={conv.senderName} 
                            className="w-11 h-11 rounded-full object-cover border border-gray-100" 
                          />
                        ) : (
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shadow-xs ${getAvatarForCustomer(conv.senderName, conv.customerId).colorClass}`}>
                            {getAvatarForCustomer(conv.senderName, conv.customerId).initial}
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-xs">
                          <i className="fa-brands fa-facebook text-blue-600 text-[10px]"></i>
                        </div>
                      </div>
                      <div className="ml-3 flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h3 className={`font-bold text-sm truncate flex items-center gap-1 ${isSelected ? 'text-indigo-950' : 'text-gray-900'}`}>
                            {conv.senderName}
                            {cInfo?.isStarred && <i className="fa-solid fa-star text-amber-400 text-[10px]"></i>}
                          </h3>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap ml-1">{conv.lastTime || ''}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-blue-600 font-medium">Facebook Page</span>
                          {cInfo?.status && (
                            <span className="text-[9px] bg-gray-100 text-gray-600 px-1 rounded">{cInfo.status}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 truncate mt-0.5">
                          {conv.lastMessage || 'ไม่มีข้อความ'}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 3. หน้าต่างแชทตรงกลาง */}
          <div className="flex-1 flex flex-col bg-[#f9fafb] relative min-w-0">
            <div className="h-[60px] bg-white border-b border-gray-200 flex justify-between items-center px-6 shrink-0">
              <div className="flex items-center">
                {activeCustomerInfo.senderAvatar ? (
                  <img 
                    src={activeCustomerInfo.senderAvatar} 
                    alt={activeCustomerInfo.senderName} 
                    className="w-9 h-9 rounded-full object-cover border border-gray-100" 
                  />
                ) : (
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-xs ${getAvatarForCustomer(activeCustomerInfo.senderName, activeCustomerId).colorClass}`}>
                    {getAvatarForCustomer(activeCustomerInfo.senderName, activeCustomerId).initial}
                  </div>
                )}
                <div className="ml-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-gray-900 text-[15px]">
                      {activeCustomerInfo.senderName || "เลือกลูกค้าจากรายการ"}
                    </h2>
                    <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-sm font-semibold">ลูกค้า Facebook</span>
                    <button 
                      onClick={() => alert(`🤖 สรุปจาก AI สำหรับ ${activeCustomerInfo.senderName}:\nลูกค้ารายนี้ต้องการซื้อสินค้าชิ้นเดิม (เสื้อสีแดงไซส์ M) แต่ยังลังเลเรื่องค่าส่ง\n💡 คำแนะนำ: เสนอโปรส่งฟรีให้ลูกค้า เพื่อปิดการขายได้ทันที!`)}
                      className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-[10px] px-2 py-0.5 rounded-sm font-bold flex items-center gap-1 transition-colors ml-2"
                    >
                      <i className="fa-solid fa-sparkles text-indigo-500"></i> AI สรุปแชท
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500">ID: {activeCustomerId || '-'}</p>
                </div>
              </div>
              
              {/* --- ข้อมูลแอดมินที่ล็อกอินอยู่ (ของจริง) --- */}
              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-lg text-xs">
                  <span className="text-gray-500 font-bold">แอดมินที่ออนไลน์:</span>
                  <div className="flex gap-2">
                    {onlineAdmins.map((name, i) => (
                      <span key={i} className="flex items-center gap-1 font-bold text-gray-700 bg-white px-2 py-0.5 rounded shadow-sm border border-gray-200">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        {name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{loggedInUser.role}</span>
                    <span className="text-xs font-bold text-gray-800">{loggedInUser.name}</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black relative">
                    {loggedInUser.name.charAt(0)}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto flex flex-col space-y-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
              {activeConversationMessages.length === 0 ? (
                <div className="m-auto text-center text-gray-400 text-xs">
                  <p>ยังไม่มีข้อความกับลูกค้ารายนี้</p>
                </div>
              ) : (
                activeConversationMessages.map((msg, index) => (
                  <div key={msg.id || index} className={`flex flex-col ${msg.isCustomer ? 'items-start' : 'items-end'}`}>
                    <div className="flex items-end max-w-[70%]">
                      {msg.isCustomer && (
                        msg.senderAvatar || activeCustomerInfo.senderAvatar ? (
                          <img src={msg.senderAvatar || activeCustomerInfo.senderAvatar} alt="Customer" className="w-7 h-7 rounded-full mr-2 mb-1 object-cover shrink-0" />
                        ) : (
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] mr-2 mb-1 shrink-0 ${getAvatarForCustomer(msg.senderName || activeCustomerInfo.senderName, msg.senderId || activeCustomerId).colorClass}`}>
                            {getAvatarForCustomer(msg.senderName || activeCustomerInfo.senderName, msg.senderId || activeCustomerId).initial}
                          </div>
                        )
                      )}
                      <div className={`px-4 py-2.5 shadow-sm ${
                        msg.isCustomer 
                          ? 'bg-white text-gray-800 rounded-2xl rounded-bl-sm border border-gray-100' 
                          : 'bg-[#4f46e5] text-white rounded-2xl rounded-br-sm'
                      }`}>
                        {msg.imageUrl && (
                          <div className="mb-2 relative group cursor-pointer overflow-hidden rounded-lg" onClick={() => window.open(msg.imageUrl, '_blank')}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={msg.imageUrl} alt="attached" className="max-w-[200px] max-h-[300px] object-cover rounded-lg border border-gray-200" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="bg-white text-gray-800 text-[10px] px-3 py-1.5 rounded-full font-bold flex items-center gap-1 shadow-lg">
                                <i className="fa-solid fa-magnifying-glass"></i> ดูรูปภาพ
                              </button>
                            </div>
                          </div>
                        )}
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] text-gray-400 mt-1 font-medium ${msg.isCustomer ? 'ml-9' : 'mr-1'} flex items-center gap-1`}>
                      {!msg.isCustomer && msg.repliedBy && (
                        <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-[9px] font-semibold border border-gray-300">ตอบโดย: {msg.repliedBy}</span>
                      )}
                      {msg.time}
                    </span>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>

            <div className="bg-white border-t border-gray-200 px-4 py-3 shrink-0 z-20">
              <div className="flex gap-2 mb-2">
                <button onClick={() => handleQuickReply("ยอดรวม 250 บาท ส่งฟรีครับ สนใจรับไหมครับ?")} className="text-[11px] bg-gray-100 text-gray-600 px-3 py-1 rounded-full hover:bg-gray-200 transition-colors">แจ้งยอด/ส่งฟรี</button>
                <button onClick={() => handleQuickReply("รบกวนขอ ชื่อ ที่อยู่ และเบอร์โทรศัพท์สำหรับจัดส่งด้วยนะครับ 🙏")} className="text-[11px] bg-gray-100 text-gray-600 px-3 py-1 rounded-full hover:bg-gray-200 transition-colors">ขอที่อยู่จัดส่ง</button>
                <button onClick={() => handleQuickReply("จัดส่งพัสดุเรียบร้อยครับ เลขพัสดุ: TH123456789 (เช็คสถานะได้ที่ Kerry ครับ)")} className="text-[11px] bg-gray-100 text-gray-600 px-3 py-1 rounded-full hover:bg-gray-200 transition-colors">ส่งเลขพัสดุ</button>
              </div>
              <form onSubmit={handleSendReply} className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1.5 focus-within:border-[#4f46e5] focus-within:ring-1 focus-within:ring-[#4f46e5] transition-all">
                <textarea 
                  placeholder={`พิมพ์ข้อความตอบกลับในฐานะ ${loggedInUser.name}...`} 
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  disabled={isSending}
                  rows={1}
                  className="flex-1 bg-transparent border-none text-gray-900 placeholder-gray-400 text-[13px] focus:ring-0 resize-none pt-2 outline-none h-9 pl-3"
                />
                <button 
                  type="submit" 
                  disabled={isSending || !replyText.trim()}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    replyText.trim() && !isSending ? 'bg-[#4f46e5] text-white shadow-md' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isSending ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
                </button>
              </form>
            </div>
          </div>

          {/* 4. แถบสรุปออเดอร์ขวามือ */}
          <div className="w-[300px] bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-y-auto z-10">
            <div className="p-4 border-b border-gray-100">
              <button 
                onClick={() => setIsBillModalOpen(true)}
                className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                <i className="fa-solid fa-file-invoice"></i> สร้างบิล / สรุปยอด
              </button>
            </div>
            
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm mb-3">
                <i className="fa-solid fa-address-card text-[#4f46e5]"></i> ข้อมูลลูกค้า
              </h3>
              {(() => {
                const customerId = activeCustomerId;
                const currentInfo = customersInfo[customerId] || { phone: '', address: '', tags: [] };
                return (
                  <div className="text-[12px] space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-gray-500 text-[10px] mb-0.5">ชื่อเฟซบุ๊ก</p>
                        <p className="font-medium text-gray-900 flex items-center gap-1">
                          {activeCustomerInfo.senderName || "รอลูกค้าทักมา..."}
                          {customerId && (
                            <button onClick={() => handleToggleStar(customerId)} className="focus:outline-none transition-transform hover:scale-110 ml-1">
                              {currentInfo.isStarred ? <i className="fa-solid fa-star text-amber-400 text-sm"></i> : <i className="fa-regular fa-star text-gray-300 text-sm hover:text-amber-400"></i>}
                            </button>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    {customerId && (
                      <div>
                        <p className="text-gray-500 text-[10px] mb-1">แท็ก (Tags)</p>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {(currentInfo.tags || []).map((t: string, idx: number) => (
                            <span key={idx} className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                              {t}
                              <button onClick={() => handleRemoveTag(customerId, t)} className="hover:text-red-500"><i className="fa-solid fa-xmark"></i></button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { handleAddTag(customerId, tagInput); setTagInput(''); } }} placeholder="เพิ่มแท็กแล้วกด Enter..." className="flex-1 border border-gray-200 rounded px-2 py-1 text-[10px] focus:outline-none focus:border-indigo-500 bg-gray-50 text-gray-800" />
                          <button onClick={() => { handleAddTag(customerId, tagInput); setTagInput(''); }} className="bg-indigo-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-indigo-700">เพิ่ม</button>
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex justify-between items-center mb-0.5">
                        <p className="text-gray-500 text-[10px]">สถานะการชำระเงิน</p>
                        {orderStatus === 'รอตรวจสอบสลิป' && (
                          <button 
                            onClick={() => {
                              alert('🤖 AI กำลังสแกนสแกน QR Code สลิปโอนเงิน...\n✅ ยอดเงิน 1,500 บาท ตรงกับบิลพอดี!');
                              setOrderStatus('โอนแล้ว');
                              if (customerId) {
                                handleSaveCustomerInfo(customerId, currentInfo.phone, currentInfo.address, 'โอนแล้ว', currentInfo.isStarred, currentInfo.tags);
                              }
                            }}
                            className="text-[9px] bg-indigo-600 text-white px-2 py-0.5 rounded font-bold hover:bg-indigo-700 flex items-center gap-1 shadow-sm animate-pulse"
                          >
                            <i className="fa-solid fa-wand-magic-sparkles"></i> AI ตรวจสลิป
                          </button>
                        )}
                      </div>
                      <select 
                        value={orderStatus} 
                        onChange={(e) => {
                          const newStatus = e.target.value as any;
                          setOrderStatus(newStatus);
                          if (customerId) {
                            handleSaveCustomerInfo(customerId, currentInfo.phone, currentInfo.address, newStatus, currentInfo.isStarred, currentInfo.tags);
                          }
                        }}
                        className={`w-full text-xs font-bold px-2 py-1.5 rounded outline-none border cursor-pointer ${
                          orderStatus === 'รอโอนเงิน' ? 'bg-gray-50 text-gray-600 border-gray-200' :
                          orderStatus === 'รอตรวจสอบสลิป' ? 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse' :
                          orderStatus === 'โอนแล้ว' ? 'bg-green-50 text-green-600 border-green-200' :
                          'bg-blue-50 text-blue-600 border-blue-200'
                        }`}
                      >
                        <option value="รอโอนเงิน">⚪ รอโอนเงิน</option>
                        <option value="รอตรวจสอบสลิป">⏳ รอตรวจสอบสลิป</option>
                        <option value="โอนแล้ว">✅ โอนแล้ว</option>
                        <option value="จัดส่งแล้ว">📦 จัดส่งแล้ว</option>
                      </select>
                    </div>
                  </div>
                );
              })()}

                {/* --- ส่วนกรอกที่อยู่จัดส่ง --- */}
                {messages.length > 0 && messages.find(m => m.isCustomer && m.senderId) && (() => {
                  const customerId = [...messages].reverse().find(m => m.isCustomer && m.senderId)?.senderId;
                  const currentInfo = customersInfo[customerId] || { phone: '', address: '' };
                  
                  const handleAutoExtract = () => {
                    // ดึงข้อความทั้งหมดของลูกค้ารายนี้มาวิเคราะห์
                    const customerMsgs = messages.filter(m => m.isCustomer && m.senderId === customerId).map(m => m.text);
                    let foundPhone = currentInfo.phone;
                    let foundAddress = currentInfo.address;

                    for (const text of customerMsgs) {
                      if (!text) continue;
                      // 1. หาเบอร์โทรศัพท์ (ขึ้นต้นด้วย 0 ตามด้วยตัวเลข 9 ตัว)
                      const phoneMatch = text.replace(/[-\s]/g, '').match(/(0[689]\d{8})/);
                      if (phoneMatch) foundPhone = phoneMatch[0];

                      // 2. หาที่อยู่ (มีตัวเลข 5 หลักที่เป็นรหัสไปรษณีย์ หรือมีคำว่า จังหวัด/อำเภอ/ตำบล)
                      if (/\d{5}/.test(text) && text.length > 15) {
                        foundAddress = text;
                      } else if (/(จ\.|จังหวัด|อ\.|อำเภอ|เขต|แขวง|ต\.|ตำบล|ถนน|ซอย|บ้านเลขที่)/.test(text) && text.length > 15) {
                        foundAddress = text;
                      }
                    }

                    if (foundPhone !== currentInfo.phone || foundAddress !== currentInfo.address) {
                      handleSaveCustomerInfo(customerId, foundPhone, foundAddress);
                      // สร้าง effect กระพริบให้รู้ว่าดึงมาแล้ว
                    } else {
                      alert("ไม่พบข้อมูลที่อยู่/เบอร์โทรในประวัติแชทครับ หรืออาจจะดึงมาครบแล้ว");
                    }
                  };

                  return (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                          <i className="fa-solid fa-map-location-dot text-[#4f46e5]"></i> ข้อมูลจัดส่ง
                        </h3>
                        <button 
                          onClick={handleAutoExtract}
                          className="text-[10px] bg-purple-100 text-purple-700 hover:bg-purple-200 px-2 py-1 rounded font-bold flex items-center gap-1 transition-colors"
                          title="ให้ AI ช่วยหาที่อยู่จากแชท"
                        >
                          <i className="fa-solid fa-wand-magic-sparkles"></i> ดึงที่อยู่อัตโนมัติ
                        </button>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-gray-500 text-[10px] mb-0.5">เบอร์โทรศัพท์</p>
                          <input 
                            type="text" 
                            placeholder="08X-XXX-XXXX"
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 font-bold focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
                            value={currentInfo.phone}
                            onChange={(e) => handleSaveCustomerInfo(customerId, e.target.value, currentInfo.address)}
                          />
                        </div>
                        <div>
                          <p className="text-gray-500 text-[10px] mb-0.5">ที่อยู่จัดส่ง</p>
                          <textarea 
                            rows={3}
                            placeholder="บ้านเลขที่ หมู่ ซอย ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 font-bold focus:outline-none focus:ring-1 focus:ring-[#4f46e5] resize-none"
                            value={currentInfo.address}
                            onChange={(e) => handleSaveCustomerInfo(customerId, currentInfo.phone, e.target.value)}
                          />
                        </div>
                        <button 
                          onClick={() => setIsPrintingLabel(true)}
                          disabled={!currentInfo.address}
                          className={`w-full py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors ${
                            currentInfo.address ? 'bg-gray-800 text-white hover:bg-black' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <i className="fa-solid fa-print"></i> พิมพ์จ่าหน้าพัสดุ
                        </button>
                      </div>
                    </div>
                  );
                })()}
                
            </div>
          </div>
        </>
      )}

      {/* --- TAB สินค้า (Products Inventory) --- */}
      {activeTab === 'products' && (
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <i className="fa-solid fa-box-open text-[#4f46e5]"></i> คลังสินค้า (Inventory)
            </h1>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
              <div className="bg-gray-50 p-4 border-b border-gray-200 font-bold text-gray-700">
                เพิ่มสินค้าใหม่
              </div>
              <form onSubmit={handleAddProductDB} className="p-4 flex flex-wrap gap-3 items-end">
                <div className="w-32">
                  <label className="text-[11px] text-gray-700 font-semibold block mb-1">รหัสสินค้า</label>
                  <input 
                    value={newProdId} 
                    onChange={e=>setNewProdId(e.target.value)} 
                    type="text" 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white outline-none focus:ring-2 focus:ring-[#4f46e5] focus:border-transparent transition-all shadow-xs uppercase font-mono" 
                    placeholder="เช่น P001" 
                  />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-[11px] text-gray-700 font-semibold block mb-1">ชื่อสินค้า</label>
                  <input required value={newProdName} onChange={e=>setNewProdName(e.target.value)} type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 bg-white outline-none focus:ring-2 focus:ring-[#4f46e5] focus:border-transparent transition-all shadow-xs" placeholder="เช่น กระเป๋าสะพาย" />
                </div>
                <div className="flex-1 min-w-[240px]">
                  <label className="text-[11px] text-gray-700 font-semibold block mb-1">
                    รูปสินค้า (เลือกรูปจากเครื่อง หรือ วางลิงก์)
                  </label>
                  <div className="flex items-center gap-2">
                    {newProdImage ? (
                      <div className="relative group w-10 h-10 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex-shrink-0 shadow-xs">
                        <img src={newProdImage} alt="preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setNewProdImage('')}
                          className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                          title="ลบรูปภาพ"
                        >
                          <i className="fa-solid fa-times"></i>
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer border border-dashed border-indigo-300 hover:border-[#4f46e5] rounded-lg px-2.5 py-1.5 text-xs text-[#4f46e5] flex items-center gap-1.5 bg-indigo-50/60 hover:bg-indigo-50 transition-colors h-[38px] flex-shrink-0 font-medium">
                        {isUploadingImage ? (
                          <i className="fa-solid fa-circle-notch fa-spin"></i>
                        ) : (
                          <i className="fa-solid fa-cloud-arrow-up text-sm"></i>
                        )}
                        <span>{isUploadingImage ? 'กำลังโหลด...' : 'เลือกรูป'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isUploadingImage}
                          onChange={handleProductImageUpload}
                        />
                      </label>
                    )}
                    <input
                      value={newProdImage.startsWith('data:') ? '(อัปโหลดรูปภาพแล้ว ✓)' : newProdImage}
                      disabled={newProdImage.startsWith('data:')}
                      onChange={e=>setNewProdImage(e.target.value)}
                      type="text"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 bg-white outline-none focus:ring-2 focus:ring-[#4f46e5] focus:border-transparent transition-all shadow-xs disabled:bg-gray-100 disabled:text-gray-600 disabled:font-medium"
                      placeholder="หรือวางลิงก์รูปภาพ..."
                    />
                  </div>
                </div>
                <div className="w-24">
                  <label className="text-[11px] text-gray-700 font-semibold block mb-1">ราคา (฿)</label>
                  <input required value={newProdPrice} onChange={e=>setNewProdPrice(e.target.value)} type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 bg-white outline-none focus:ring-2 focus:ring-[#4f46e5] focus:border-transparent transition-all shadow-xs" placeholder="0" />
                </div>
                <div className="w-20">
                  <label className="text-[11px] text-gray-700 font-semibold block mb-1">สต็อก</label>
                  <input required value={newProdStock} onChange={e=>setNewProdStock(e.target.value)} type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 bg-white outline-none focus:ring-2 focus:ring-[#4f46e5] focus:border-transparent transition-all shadow-xs" placeholder="0" />
                </div>
                <div className="w-24">
                  <label className="text-[11px] text-gray-700 font-semibold block mb-1">น้ำหนัก (กรัม)</label>
                  <input required value={newProdWeight} onChange={e=>setNewProdWeight(e.target.value)} type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 bg-white outline-none focus:ring-2 focus:ring-[#4f46e5] focus:border-transparent transition-all shadow-xs" placeholder="0" />
                </div>
                <button 
                  type="submit" 
                  disabled={isSubmittingProduct}
                  className="bg-[#4f46e5] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-indigo-600 h-[38px] flex items-center transition-colors disabled:bg-indigo-300"
                >
                  {isSubmittingProduct ? (
                    <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>
                  ) : (
                    <i className="fa-solid fa-plus mr-2"></i>
                  )}
                  {isSubmittingProduct ? 'กำลังบันทึก...' : 'เพิ่ม'}
                </button>
              </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase border-b border-gray-200">
                  <tr>
                    <th className="p-4 w-16 text-center">รูป</th>
                    <th className="p-4 w-24">รหัส</th>
                    <th className="p-4">ชื่อสินค้า</th>
                    <th className="p-4 text-right">น้ำหนัก</th>
                    <th className="p-4 text-right">ราคา</th>
                    <th className="p-4 text-right">สต็อกคงเหลือ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-center">
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="w-10 h-10 object-cover rounded-lg border border-gray-200 mx-auto shadow-xs" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xs mx-auto">
                            <i className="fa-solid fa-image"></i>
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-mono text-xs text-gray-500">{p.id}</td>
                      <td className="p-4 font-semibold text-gray-800">{p.name}</td>
                      <td className="p-4 text-right text-gray-500 text-xs">{p.weight ? `${p.weight}g` : '-'}</td>
                      <td className="p-4 text-right text-[#10b981] font-bold">{p.price} ฿</td>
                      <td className="p-4 text-right flex items-center justify-end gap-3">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${p.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {p.stock} ชิ้น
                        </span>
                        <button onClick={() => handleDeleteProductDB(p.id)} className="text-red-400 hover:text-red-600 transition-colors">
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB ลูกค้า (Customers) --- */}
      {activeTab === 'customers' && (
        <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <i className="fa-solid fa-users text-[#4f46e5]"></i> ฐานข้อมูลลูกค้า (CRM)
            </h1>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <div className="relative w-64">
                  <i className="fa-solid fa-search absolute left-3 top-2.5 text-gray-400 text-xs"></i>
                  <input type="text" placeholder="ค้นหาชื่อลูกค้า..." className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#4f46e5]" />
                </div>
                <button className="text-xs bg-[#4f46e5] text-white px-3 py-1.5 rounded-lg font-bold"><i className="fa-solid fa-download mr-1"></i> Export CSV</button>
              </div>
              <table className="w-full text-left">
                <thead className="bg-white text-gray-500 text-xs uppercase border-b border-gray-200">
                  <tr>
                    <th className="p-4">ชื่อลูกค้า (Facebook)</th>
                    <th className="p-4 text-center">ออเดอร์ล่าสุด</th>
                    <th className="p-4 text-center">ยอดรวมที่เคยซื้อ</th>
                    <th className="p-4 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* ดึงลูกค้าจากประวัติแชทมาจำลองให้ดู */}
                  {Array.from(new Set(messages.filter(m => m.isCustomer && m.senderName).map(m => m.senderName))).map((name, idx) => {
                    const customerMsg = messages.find(m => m.senderName === name);
                    return (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 flex items-center gap-3">
                          <img src={customerMsg?.senderAvatar || "https://i.pravatar.cc/150?img=5"} className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                          <div>
                            <p className="font-bold text-gray-800 text-sm">{name}</p>
                            <p className="text-[10px] text-gray-400">Facebook Inbox</p>
                          </div>
                        </td>
                        <td className="p-4 text-center text-xs text-gray-600">วันนี้</td>
                        <td className="p-4 text-center font-bold text-[#10b981]">฿ 0</td>
                        <td className="p-4 text-center">
                          <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold">ลูกค้าใหม่</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB ตั้งค่า (Settings) --- */}
      {activeTab === 'settings' && loggedInUser?.role === 'admin' && (
        <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <i className="fa-solid fa-gear text-[#4f46e5]"></i> ตั้งค่าระบบ
            </h1>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                <i className="fa-brands fa-facebook text-blue-600 text-xl"></i>
                <div>
                  <h3 className="font-bold text-gray-800">เชื่อมต่อ Facebook Page</h3>
                  <p className="text-xs text-gray-500">สถานะ Webhook และ Graph API</p>
                </div>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-center bg-green-50/30 p-4 rounded-xl border border-green-100">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{appConfig.pageName || 'เพจที่เชื่อมต่ออยู่'}</p>
                      <p className="text-[10px] text-gray-500">Token: {appConfig.accessToken ? `${appConfig.accessToken.slice(0, 15)}...` : 'N/A'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      const newPage = prompt("กรอกชื่อเพจใหม่:");
                      const newToken = prompt("กรอก Page Access Token ใหม่ (จาก Facebook Dev Portal):");
                      if (newPage && newToken) {
                         fetch('/api/config', {
                           method: 'POST',
                           headers: { 'Content-Type': 'application/json' },
                           body: JSON.stringify({ pageName: newPage, accessToken: newToken })
                         }).then(() => {
                           alert('เปลี่ยนเพจสำเร็จ!');
                           setAppConfig((prev: any) => ({...prev, pageName: newPage, accessToken: newToken}));
                         });
                      }
                    }}
                    className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-bold shadow-sm hover:bg-gray-50 transition-colors"
                  >
                    เปลี่ยนเพจ (Update Token)
                  </button>
                </div>

                <button 
                  onClick={handleFBLogin}
                  disabled={isLoadingFb}
                  className={`mt-4 w-full text-white font-bold py-3 rounded-lg shadow-sm transition-colors flex justify-center items-center gap-2 ${isLoadingFb ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#1877F2] hover:bg-[#166fe5]'}`}
                >
                  {isLoadingFb ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-brands fa-facebook-f"></i>}
                  {isLoadingFb ? 'กำลังเชื่อมต่อกับ Facebook...' : 'เชื่อมต่อเพจด้วยบัญชี Facebook (Login with FB)'}
                </button>

                {/* คำแนะนำการเชื่อมต่อ */}
                <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-900">
                  <p className="font-bold mb-2 flex items-center gap-2">
                    <i className="fa-solid fa-circle-info"></i> คำแนะนำการเชื่อมต่อ (สำคัญ)
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-[13px] text-blue-800">
                    <li>เนื่องจากแอปนี้อยู่ใน <b>โหมดนักพัฒนา (Developer Mode)</b></li>
                    <li>ผู้ที่จะกดปุ่ม Login ด้านบนได้ ต้องมีชื่อเป็น <b>Developer</b> หรือ <b>Tester</b> ในหน้า Facebook App Dashboard เท่านั้น</li>
                    <li><b>วิธีกดเชื่อมต่อ:</b> กดปุ่มสีฟ้าด้านบน &rarr; ล็อกอิน Facebook &rarr; <b>เลือกเพจ</b>ที่ต้องการดึงแชท &rarr; กดยืนยันสิทธิ์</li>
                    <li>เมื่อเชื่อมต่อสำเร็จ ระบบจะผูก Webhook ให้กับเพจนั้นอัตโนมัติ และคุณจะสามารถตอบแชทของเพจนั้นได้ทันที</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* ข้อมูลร้านค้า (สำหรับพิมพ์ใบปะหน้า) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                  <i className="fa-solid fa-store"></i>
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">ข้อมูลร้านค้า (ผู้ส่ง)</h3>
                  <p className="text-xs text-gray-500">ใช้สำหรับแสดงบนใบปะหน้าพัสดุ</p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ชื่อร้านค้า (หรือชื่อผู้ส่ง)</label>
                  <input type="text" className="w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:border-orange-500" value={appConfig.shopName} onChange={(e) => setAppConfig({...appConfig, shopName: e.target.value})} placeholder="เช่น ร้าน อริสา จิวเวลรี่" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">เบอร์โทรศัพท์ร้านค้า</label>
                  <input type="text" className="w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:border-orange-500" value={appConfig.shopPhone} onChange={(e) => setAppConfig({...appConfig, shopPhone: e.target.value})} placeholder="เช่น 081-234-5678" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ที่อยู่ร้านค้า</label>
                  <textarea className="w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:border-orange-500 h-24 resize-none" value={appConfig.shopAddress} onChange={(e) => setAppConfig({...appConfig, shopAddress: e.target.value})} placeholder="กรอกที่อยู่ผู้ส่งแบบเต็ม..."></textarea>
                </div>
                
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <label className="block text-xs font-bold text-gray-700 mb-3">อัตราค่าจัดส่ง (กิโลกรัมแรก / +กิโลกรัมถัดไป)</label>
                  {appConfig.shippingOptions?.map((o: any, idx: number) => (
                    <div key={o.id} className="flex gap-3 items-center mb-3">
                      <span className="w-28 text-sm font-medium text-gray-800">{o.name}</span>
                      <input type="number" className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm text-right focus:ring-1 focus:ring-orange-500 outline-none" placeholder="กิโลแรก" value={o.baseRate} onChange={e => {
                        const newOpts = [...appConfig.shippingOptions];
                        newOpts[idx].baseRate = Number(e.target.value);
                        setAppConfig({...appConfig, shippingOptions: newOpts});
                      }} />
                      <span className="text-xs text-gray-500">+</span>
                      <input type="number" className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm text-right focus:ring-1 focus:ring-orange-500 outline-none" placeholder="กิโลถัดไป" value={o.addRate} onChange={e => {
                        const newOpts = [...appConfig.shippingOptions];
                        newOpts[idx].addRate = Number(e.target.value);
                        setAppConfig({...appConfig, shippingOptions: newOpts});
                      }} />
                      <span className="text-xs text-gray-500">บาท</span>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => {
                    fetch('/api/config', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(appConfig)
                    }).then(() => alert('บันทึกข้อมูลร้านค้าเรียบร้อยแล้ว!'));
                  }}
                  className="w-full bg-orange-500 text-white font-bold py-3 rounded-lg shadow-sm hover:bg-orange-600 transition-colors flex justify-center items-center gap-2"
                >
                  <i className="fa-solid fa-save"></i> บันทึกข้อมูลร้านค้า
                </button>
              </div>
            </div>

            {/* --- FB Pages Selection Modal --- */}
            {isFbModalOpen && (
              <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[80vh]">
                  <div className="bg-[#1877F2] text-white p-4 font-bold flex justify-between items-center">
                    <span>เลือกเพจที่คุณต้องการเชื่อมต่อ</span>
                    <button onClick={() => setIsFbModalOpen(false)} className="hover:text-gray-200"><i className="fa-solid fa-xmark text-xl"></i></button>
                  </div>
                  <div className="p-4 overflow-y-auto flex-1">
                    {fbPages.length === 0 ? (
                      <p className="text-center text-gray-500 my-4">ไม่พบเพจ</p>
                    ) : (
                      fbPages.map(page => (
                        <div key={page.id} className="flex justify-between items-center p-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 cursor-pointer" onClick={() => handleSelectPageToConnect(page)}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">{page.name.charAt(0)}</div>
                            <div>
                              <p className="font-bold text-gray-800 text-sm">{page.name}</p>
                              <p className="text-[10px] text-gray-500">ID: {page.id}</p>
                            </div>
                          </div>
                          <button className="text-xs bg-[#1877F2] text-white px-3 py-1.5 rounded-lg font-bold hover:bg-[#166fe5]">เลือก</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                <i className="fa-solid fa-robot text-[#4f46e5] text-xl"></i>
                <div>
                  <h3 className="font-bold text-gray-800">ตั้งค่าบอท (Auto-reply)</h3>
                  <p className="text-xs text-gray-500">ข้อความต้อนรับและตอบกลับอัตโนมัติ</p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-2">ข้อความต้อนรับลูกค้าใหม่ (Welcome Message)</label>
                  <textarea 
                    className="w-full bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg p-3 text-sm focus:ring-1 focus:ring-[#4f46e5] outline-none" 
                    rows={3}
                    value={appConfig.welcomeMessage ?? "สวัสดีครับ ร้านอริสา จิวเวลรี่ ยินดีให้บริการครับ 🙏 สนใจสินค้าชิ้นไหนส่งรูปมาสอบถามได้เลยนะครับ"}
                    onChange={(e) => setAppConfig({ ...appConfig, welcomeMessage: e.target.value })}
                  />
                </div>
                <button 
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(appConfig)
                      });
                      if (res.ok) {
                        alert('บันทึกการตั้งค่าบอทเรียบร้อยแล้ว!');
                      } else {
                        alert('บันทึกการตั้งค่าไม่สำเร็จ');
                      }
                    } catch {
                      alert('เกิดข้อผิดพลาดในการบันทึก');
                    }
                  }}
                  className="bg-[#4f46e5] hover:bg-indigo-600 transition-colors cursor-pointer text-white px-4 py-2 rounded-lg text-xs font-bold"
                >
                  บันทึกการตั้งค่า
                </button>
              </div>
            </div>

            {/* --- จัดการพนักงาน (User Management) --- */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                <i className="fa-solid fa-users text-[#4f46e5] text-xl"></i>
                <div>
                  <h3 className="font-bold text-gray-800">จัดการพนักงาน (User Management)</h3>
                  <p className="text-xs text-gray-500">สร้างบัญชีให้ทีมแอดมิน</p>
                </div>
              </div>
              <div className="p-6">
                <form onSubmit={handleCreateUser} className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Username *</label>
                    <input type="text" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#4f46e5]" placeholder="เช่น admin_2" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Password *</label>
                    <input type="text" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#4f46e5]" placeholder="รหัสผ่าน" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">ชื่อที่แสดง</label>
                    <input type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#4f46e5]" placeholder="เช่น น้องเจน" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">สิทธิ์ (Role)</label>
                    <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#4f46e5]">
                      <option value="admin">ADMIN (แอดมิน)</option>
                      <option value="staff">STAFF (พนักงาน)</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button type="submit" className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-bold py-2 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer">
                      <i className="fa-solid fa-plus"></i> เพิ่มพนักงาน
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-y border-gray-200 text-xs text-gray-500 uppercase">
                        <th className="p-3 font-bold">ชื่อพนักงาน</th>
                        <th className="p-3 font-bold">Username</th>
                        <th className="p-3 font-bold">สิทธิ์ (Role)</th>
                        <th className="p-3 font-bold text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {Object.values(systemUsers).map((u: any) => (
                        <tr key={u.id || u.username} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="p-3 font-bold text-gray-800 flex items-center gap-2">
                            <img src={u.avatar} className="w-6 h-6 rounded-full" />
                            {u.name}
                          </td>
                          <td className="p-3 text-gray-600">{u.username}</td>
                          <td className="p-3">
                            <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'}`}>
                              {(u.role || 'staff').toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {(u.id || u.username) !== 'admin' && (
                              <button type="button" onClick={() => handleDeleteUser(u.id || u.username)} className="text-red-500 hover:text-red-700 text-xs font-bold cursor-pointer">
                                ลบ
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 5. Modal สรุปยอด (ดึงจากฐานข้อมูลสินค้า) */}
      {isBillModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white w-[500px] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="bg-[#10b981] p-4 flex justify-between items-center text-white">
              <h2 className="font-bold text-lg"><i className="fa-solid fa-file-invoice mr-2"></i>เปิดบิลสินค้า</h2>
              <button onClick={() => setIsBillModalOpen(false)} className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <div className="p-5 flex-1 overflow-y-auto bg-gray-50">
              <h3 className="font-semibold text-gray-800 mb-2">เลือกสินค้าจากคลัง</h3>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {products.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => handleAddProductToBill(p)}
                    className="bg-white border border-gray-200 p-2 rounded-lg flex items-center gap-2 hover:border-[#10b981] hover:shadow-sm text-left transition-all"
                  >
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="w-9 h-9 object-cover rounded-md border border-gray-100 shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xs shrink-0">
                        <i className="fa-solid fa-box"></i>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 line-clamp-1">{p.name}</p>
                      <p className="text-[10px] text-gray-500">คงเหลือ {p.stock}</p>
                    </div>
                    <span className="text-xs font-bold text-[#10b981] bg-green-50 px-2 py-1 rounded shrink-0">{p.price}฿</span>
                  </button>
                ))}
              </div>

              <h3 className="font-semibold text-gray-800 mb-3 border-b pb-2">รายการที่เลือก</h3>
              {billItems.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">ยังไม่มีสินค้าในบิล (คลิกเลือกด้านบน ☝️)</p>
              ) : (
                billItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 mb-2 items-center bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                    {item.image && (
                      <img src={item.image} alt={item.name} className="w-8 h-8 object-cover rounded border border-gray-200 shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-xs font-bold text-gray-800">{item.name}</p>
                      <p className="text-[10px] text-gray-500">ราคา {item.price} ฿</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => {
                        if(item.qty > 1) {
                          setBillItems(billItems.map(i => i.id === item.id ? {...i, qty: i.qty-1} : i));
                        } else {
                          setBillItems(billItems.filter(i => i.id !== item.id));
                        }
                      }} className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors">-</button>
                      <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                      <button onClick={() => setBillItems(billItems.map(i => i.id === item.id ? {...i, qty: i.qty+1} : i))} className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors">+</button>
                    </div>
                    <p className="text-xs font-bold text-gray-800 w-12 text-right">{item.price * item.qty}฿</p>
                  </div>
                ))
              )}

              <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700 text-sm">บริการขนส่ง</span>
                  <select 
                    value={selectedCourier} 
                    onChange={e => setSelectedCourier(e.target.value)}
                    className="w-32 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[#10b981]"
                  >
                    {appConfig.shippingOptions?.map((o: any) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                    {!appConfig.shippingOptions?.length && <option value="flash">Flash Express</option>}
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-gray-700 text-sm block">ค่าจัดส่ง (บาท)</span>
                    {billItems.reduce((s, i) => s + ((i.weight || 0) * i.qty), 0) > 0 && (
                      <span className="text-[10px] text-gray-400">
                        น้ำหนักรวม: {billItems.reduce((s, i) => s + ((i.weight || 0) * i.qty), 0).toLocaleString()} กรัม
                      </span>
                    )}
                  </div>
                  <input type="number" value={shippingFee || ''} onChange={e => setShippingFee(Number(e.target.value))} className="w-24 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-right focus:ring-1 focus:ring-[#10b981] outline-none" placeholder="0" />
                </div>
              </div>

              <div className="mt-4 p-4 bg-green-100 rounded-xl flex justify-between items-center border border-green-200 shadow-inner">
                <span className="font-bold text-green-900 text-base">ยอดรวมทั้งสิ้น</span>
                <span className="font-black text-2xl text-[#059669]">{calculateTotal()} ฿</span>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-gray-100 flex justify-end gap-2 shrink-0">
              <button onClick={() => setIsBillModalOpen(false)} className="px-5 py-2.5 rounded-lg text-gray-600 font-semibold hover:bg-gray-100 transition-colors">ยกเลิก</button>
              <button onClick={handleSendBill} disabled={isSending || billItems.length === 0} className={`px-6 py-2.5 rounded-lg text-white font-bold transition-colors flex items-center gap-2 shadow-sm ${
                billItems.length === 0 || isSending ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#10b981] hover:bg-[#059669]'
              }`}>
                {isSending ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
                สรุปยอดส่งลูกค้า
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal สำหรับพิมพ์จ่าหน้าพัสดุ (Print Label) */}
      {isPrintingLabel && messages.length > 0 && messages.find(m => m.isCustomer && m.senderId) && (() => {
        const lastCustomerMsg = [...messages].reverse().find(m => m.isCustomer && m.senderId);
        const currentInfo = customersInfo[lastCustomerMsg?.senderId] || {};
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm print:bg-white print:backdrop-blur-none">
            
            {/* กล่องบรรจุ UI สำหรับบนหน้าจอ (ซ่อนตอนปริ้นท์) */}
            <div className="absolute top-6 right-6 flex gap-3 print:hidden">
              <button 
                onClick={() => setIsPrintingLabel(false)}
                className="bg-gray-800 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
              <button 
                onClick={() => window.print()}
                className="bg-[#10b981] text-white px-5 py-2 rounded-full font-bold hover:bg-[#059669] transition-colors flex items-center gap-2 shadow-lg"
              >
                <i className="fa-solid fa-print"></i> สั่งพิมพ์ทันที
              </button>
            </div>

            {/* ส่วนที่จะแสดงลงในกระดาษ (ใบจ่าหน้าพัสดุ) */}
            <div className="bg-white w-[10cm] h-[15cm] shadow-2xl print:shadow-none print:w-full print:h-auto overflow-hidden relative border-4 border-black text-black" style={{ backgroundColor: 'white', color: 'black' }}>
              {/* ผู้ส่ง */}
              <div className="p-4 border-b-2 border-dashed border-black bg-white print:bg-transparent text-black" style={{ backgroundColor: 'white', color: 'black' }}>
                <p className="text-[10px] font-bold text-black uppercase tracking-widest mb-1" style={{ color: 'black' }}>ผู้ส่ง (Sender)</p>
                <p className="font-bold text-sm text-black" style={{ color: 'black' }}>{appConfig.shopName || 'ชื่อร้านค้า...'}</p>
                <p className="text-xs mt-1 text-black whitespace-pre-wrap" style={{ color: 'black' }}>{appConfig.shopAddress || 'ที่อยู่ร้านค้า...'}</p>
                <p className="text-xs font-bold mt-1 text-black" style={{ color: 'black' }}>โทร: {appConfig.shopPhone || '-'}</p>
              </div>
              
              {/* ผู้รับ */}
              <div className="p-6 text-black" style={{ backgroundColor: 'white', color: 'black' }}>
                <p className="text-xs font-bold text-black uppercase tracking-widest mb-2 border-b-2 border-black inline-block pb-1" style={{ color: 'black', borderColor: 'black' }}>ผู้รับ (Receiver)</p>
                <p className="font-black text-xl mb-3 text-black" style={{ color: 'black' }}>{lastCustomerMsg?.senderName}</p>
                <p className="text-base leading-relaxed whitespace-pre-wrap font-medium text-black" style={{ color: 'black' }}>{currentInfo.address}</p>
                
                <div className="mt-6 flex items-center gap-3 bg-white border-2 border-black print:bg-transparent print:border-2 print:border-black p-3 rounded-lg text-black" style={{ backgroundColor: 'white', borderColor: 'black' }}>
                  <i className="fa-solid fa-phone text-xl text-black" style={{ color: 'black' }}></i>
                  <p className="font-black text-xl tracking-wider text-black" style={{ color: 'black' }}>{currentInfo.phone || 'ไม่ได้ระบุเบอร์โทร'}</p>
                </div>
              </div>

              {/* Barcode/Tracking ดัมมี่ */}
              <div className="absolute bottom-0 w-full p-4 border-t-4 border-black flex flex-col items-center justify-center bg-white text-black" style={{ backgroundColor: 'white', borderColor: 'black' }}>
                <p className="font-mono text-3xl tracking-[0.5em] font-black text-black" style={{ color: 'black' }}>*TH123456789*</p>
                <p className="text-[10px] font-bold uppercase mt-1 text-black" style={{ color: 'black' }}>โปรดส่งระวังแตก (Fragile)</p>
              </div>
            </div>

            {/* สไตล์สำหรับซ่อนส่วนอื่นตอนปริ้นท์ */}
            <style dangerouslySetInnerHTML={{__html: `
              @media print {
                body * { visibility: hidden; }
                .print\\:hidden { display: none !important; }
                .fixed.inset-0 > div:not(.print\\:hidden) * { visibility: visible; }
                .fixed.inset-0 { position: absolute; left: 0; top: 0; background: transparent; }
              }
            `}} />
          </div>
        );
      })()}

    </div>
  );
}
