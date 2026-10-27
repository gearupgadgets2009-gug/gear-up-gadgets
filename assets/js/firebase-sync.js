/* ==========================================================================
   Gear Up Gadgets - Firebase Cloud Firestore Real-Time Synchronization Engine
   Handles real-time syncing for:
   1. Customer Orders (Storefront -> Firestore -> Admin Panel)
   2. Repair Requests (Repair Form -> Firestore -> Admin Panel / Track)
   3. Contact Inquiries (Contact Form -> Firestore -> Admin Panel)
   4. Catalog Products (Admin Panel <-> Firestore <-> Storefront)
   Includes robust Firestore REST API fallback if SDK is blocked or offline.
   ========================================================================== */

(function() {
    'use strict';

    const PROJECT_ID = "gear-up-gadgets";
    const REST_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

    // -------------------------------------------------------------
    // REST API Helpers (Fallback when Firebase JS SDK is blocked)
    // -------------------------------------------------------------
    function toFirestoreValue(val) {
        if (val === null || val === undefined) return { nullValue: null };
        if (typeof val === 'boolean') return { booleanValue: val };
        if (typeof val === 'number') {
            return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
        }
        if (typeof val === 'string') return { stringValue: val };
        if (Array.isArray(val)) {
            return { arrayValue: { values: val.map(toFirestoreValue) } };
        }
        if (typeof val === 'object') {
            const fields = {};
            for (const k in val) {
                if (val[k] !== undefined) {
                    fields[k] = toFirestoreValue(val[k]);
                }
            }
            return { mapValue: { fields } };
        }
        return { stringValue: String(val) };
    }

    function fromFirestoreDoc(doc) {
        if (!doc) return null;
        const id = doc.name ? doc.name.split('/').pop() : '';
        const obj = { id };
        function parseVal(v) {
            if (!v) return null;
            if ('stringValue' in v) return v.stringValue;
            if ('integerValue' in v) return parseInt(v.integerValue, 10);
            if ('doubleValue' in v) return parseFloat(v.doubleValue);
            if ('booleanValue' in v) return v.booleanValue;
            if ('nullValue' in v) return null;
            if ('timestampValue' in v) return v.timestampValue;
            if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseVal);
            if ('mapValue' in v) {
                const m = {};
                for (const k in (v.mapValue.fields || {})) {
                    m[k] = parseVal(v.mapValue.fields[k]);
                }
                return m;
            }
            return null;
        }
        for (const k in (doc.fields || {})) {
            obj[k] = parseVal(doc.fields[k]);
        }
        return obj;
    }

    async function restSetDoc(collection, docId, data) {
        try {
            const fields = {};
            for (const key in data) {
                if (key !== 'id' && data[key] !== undefined) {
                    fields[key] = toFirestoreValue(data[key]);
                }
            }
            // Use patch to create or overwrite document cleanly
            const url = `${REST_BASE}/${collection}/${encodeURIComponent(docId)}`;
            const res = await fetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields })
            });
            return await res.json();
        } catch (e) {
            console.warn(`[GUG Firebase REST] Write error (${collection}/${docId}):`, e);
            return null;
        }
    }

    async function restGetCollection(collection) {
        try {
            const url = `${REST_BASE}/${collection}?pageSize=300`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.documents && Array.isArray(data.documents)) {
                return data.documents.map(fromFirestoreDoc);
            }
            return [];
        } catch (e) {
            console.warn(`[GUG Firebase REST] Read error (${collection}):`, e);
            return [];
        }
    }

    async function restDeleteDoc(collection, docId) {
        try {
            const url = `${REST_BASE}/${collection}/${encodeURIComponent(docId)}`;
            await fetch(url, { method: 'DELETE' });
            return true;
        } catch (e) {
            console.warn(`[GUG Firebase REST] Delete error (${collection}/${docId}):`, e);
            return false;
        }
    }

    async function restGetDoc(collection, docId) {
        try {
            const url = `${REST_BASE}/${collection}/${encodeURIComponent(docId)}`;
            const res = await fetch(url);
            if (!res.ok) return null;
            const doc = await res.json();
            return fromFirestoreDoc(doc);
        } catch (e) {
            return null;
        }
    }

    // -------------------------------------------------------------
    // Main GUG_FIREBASE Engine
    // -------------------------------------------------------------
    window.GUG_FIREBASE = {
        isLive: false,
        syncEnabled: true,
        _unsubscribers: [],

        // Initialize Real-Time Sync
        init() {
            // Check if Firebase JS SDK is initialized
            if (window.db) {
                this.isLive = true;
                console.log("🔥 [GUG Firebase] Connected via Firestore SDK! Listening to live collections...");
            } else {
                console.warn("⚠️ [GUG Firebase] Firestore SDK not active. Activating high-performance REST engine.");
                this.isLive = true; // REST works without SDK
            }

            // Products and Global Site/Footer Theme settings are always synced for both storefront and admin
            this.listenToProducts();
            this.listenToThemeConfig();

            // Detect internal management pages to avoid flooding customer shopping pages with internal collections
            const isManagementPage = /admin|orders\.html|dealer-portal|employee-portal|dashboard\.html/i.test(window.location.pathname);

            if (isManagementPage) {
                console.log("🔐 [GUG Firebase] Admin environment active: syncing full ERP management streams.");
                this.listenToOrders();
                this.listenToRepairs();
                this.listenToContacts();
                this.listenToRecovery();
                this.listenToPcBuilds();
                this.listenToEmployees();
                this.listenToDealers();
            } else {
                console.log("⚡ [GUG Firebase] Fast storefront mode: listening to live catalog stream only.");
            }

            // Hook into GugErpCore so admin / storefront actions bridge automatically
            this.patchErpCore();
        },

        // =========================================================
        // 1. ORDERS SYNCHRONIZATION
        // =========================================================
        async saveOrder(order) {
            if (!order) return;
            const orderId = String(order.id || ('GUG-ORD-' + Math.floor(100000 + Math.random() * 900000)));
            const orderData = {
                ...order,
                id: orderId,
                date: order.date || new Date().toISOString(),
                createdAt: (typeof firebase !== 'undefined' && firebase.firestore) 
                    ? firebase.firestore.FieldValue.serverTimestamp() 
                    : new Date().toISOString()
            };

            // 1. Update local cache immediately
            let localOrders = JSON.parse(localStorage.getItem('admin_orders') || '[]');
            const existingIdx = localOrders.findIndex(o => o.id === orderId);
            if (existingIdx > -1) {
                localOrders[existingIdx] = { ...localOrders[existingIdx], ...orderData };
            } else {
                localOrders.unshift(orderData);
            }
            localStorage.setItem('admin_orders', JSON.stringify(localOrders));
            window.dispatchEvent(new CustomEvent('gugOrdersUpdated', { detail: localOrders }));

            // 2. Push to Cloud Firestore
            if (window.db && this.syncEnabled) {
                try {
                    await window.db.collection('orders').doc(orderId).set(orderData, { merge: true });
                    console.log(`🔥 [GUG Firebase] Order ${orderId} saved to Cloud Firestore via SDK.`);
                    return;
                } catch (err) {
                    console.warn(`[GUG Firebase] SDK write failed for order ${orderId}, falling back to REST:`, err.message);
                }
            }

            // Fallback: REST API
            const cleanRestData = { ...orderData, createdAt: new Date().toISOString() };
            await restSetDoc('orders', orderId, cleanRestData);
            console.log(`🔥 [GUG Firebase] Order ${orderId} synced to cloud via REST API.`);
        },

        listenToOrders() {
            if (window.db) {
                try {
                    const unsub = window.db.collection('orders').onSnapshot((snapshot) => {
                        if (snapshot.empty) {
                            console.log("🔥 [GUG Firebase] Cloud orders collection is empty.");
                            return;
                        }

                        const cloudOrders = [];
                        snapshot.forEach((doc) => {
                            cloudOrders.push({
                                ...doc.data(),
                                id: doc.id
                            });
                        });

                        // Sort newest first
                        cloudOrders.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

                        localStorage.setItem('admin_orders', JSON.stringify(cloudOrders));
                        console.log(`🔥 [GUG Firebase] Synced ${cloudOrders.length} live orders from Cloud.`);
                        window.dispatchEvent(new CustomEvent('gugOrdersUpdated', { detail: cloudOrders }));
                        window.dispatchEvent(new Event('ordersReady'));
                    }, (error) => {
                        console.warn("🔥 [GUG Firebase] Orders live listener notice:", error.message);
                        this._fallbackFetchOrders();
                    });
                    this._unsubscribers.push(unsub);
                    return;
                } catch (e) {
                    console.warn("[GUG Firebase] Error attaching orders snapshot listener:", e);
                }
            }

            // Fallback fetch via REST
            this._fallbackFetchOrders();
        },

        async _fallbackFetchOrders() {
            const cloudOrders = await restGetCollection('orders');
            if (cloudOrders && cloudOrders.length > 0) {
                cloudOrders.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
                localStorage.setItem('admin_orders', JSON.stringify(cloudOrders));
                window.dispatchEvent(new CustomEvent('gugOrdersUpdated', { detail: cloudOrders }));
                window.dispatchEvent(new Event('ordersReady'));
                console.log(`🔥 [GUG Firebase] Retrieved ${cloudOrders.length} orders via REST.`);
            }
        },

        async updateOrderStatus(orderId, newStatus, paymentStatus) {
            const updates = { orderStatus: newStatus, status: newStatus };
            if (paymentStatus) updates.paymentStatus = paymentStatus;

            // Update local
            let orders = JSON.parse(localStorage.getItem('admin_orders') || '[]');
            let target = orders.find(o => o.id === orderId);
            if (target) {
                Object.assign(target, updates);
                localStorage.setItem('admin_orders', JSON.stringify(orders));
                window.dispatchEvent(new CustomEvent('gugOrdersUpdated', { detail: orders }));
            }

            // Sync to cloud
            if (window.db) {
                try {
                    await window.db.collection('orders').doc(orderId).set(updates, { merge: true });
                    console.log(`🔥 [GUG Firebase] Order ${orderId} status updated to ${newStatus} in Cloud.`);
                    return;
                } catch (e) {
                    console.warn(`[GUG Firebase] SDK status update error:`, e);
                }
            }
            await restSetDoc('orders', orderId, updates);
        },

        async getOrderById(orderId) {
            const cleanId = String(orderId).trim().toLowerCase();
            const localOrders = JSON.parse(localStorage.getItem('admin_orders') || '[]');
            const found = localOrders.find(o => String(o.id || '').trim().toLowerCase() === cleanId);
            if (found) return found;

            // Query Cloud
            if (window.db) {
                try {
                    const doc = await window.db.collection('orders').doc(orderId).get();
                    if (doc.exists) return { ...doc.data(), id: doc.id };
                } catch (e) {}
            }
            const cloudOrders = await restGetCollection('orders');
            return cloudOrders.find(o => String(o.id || '').trim().toLowerCase() === cleanId) || null;
        },

        // =========================================================
        // 2. REPAIR REQUESTS SYNCHRONIZATION
        // =========================================================
        async saveRepairRequest(repair) {
            if (!repair) return;
            const diagId = String(repair.diagnoseId || repair.id || ('GUG-REP-' + Math.floor(100000 + Math.random() * 900000)));
            const repairData = {
                ...repair,
                diagnoseId: diagId,
                id: diagId,
                officeAddress: repair.officeAddress || '',
                status: repair.status || 'Pending',
                archived: false,
                date: repair.date || new Date().toISOString(),
                createdAt: (typeof firebase !== 'undefined' && firebase.firestore) 
                    ? firebase.firestore.FieldValue.serverTimestamp() 
                    : new Date().toISOString()
            };

            // 1. Update local cache
            let localRepairs = JSON.parse(localStorage.getItem('admin_repair_requests') || '[]');
            const existingIdx = localRepairs.findIndex(r => (r.diagnoseId || r.id) === diagId);
            if (existingIdx > -1) {
                localRepairs[existingIdx] = { ...localRepairs[existingIdx], ...repairData };
            } else {
                localRepairs.unshift(repairData);
            }
            localStorage.setItem('admin_repair_requests', JSON.stringify(localRepairs));
            window.dispatchEvent(new CustomEvent('gugRepairsUpdated', { detail: localRepairs }));

            // 2. Push to Cloud Firestore
            if (window.db && this.syncEnabled) {
                try {
                    await window.db.collection('repair_requests').doc(diagId).set(repairData, { merge: true });
                    console.log(`🔥 [GUG Firebase] Repair Request ${diagId} saved to Cloud Firestore via SDK.`);
                    return;
                } catch (err) {
                    console.warn(`[GUG Firebase] SDK write failed for repair ${diagId}, falling back to REST:`, err.message);
                }
            }

            // Fallback: REST API
            const cleanRestData = { ...repairData, createdAt: new Date().toISOString() };
            await restSetDoc('repair_requests', diagId, cleanRestData);
            console.log(`🔥 [GUG Firebase] Repair Request ${diagId} synced to cloud via REST API.`);
        },

        listenToRepairs() {
            if (window.db) {
                try {
                    const unsub = window.db.collection('repair_requests').onSnapshot((snapshot) => {
                        if (snapshot.empty) {
                            console.log("🔥 [GUG Firebase] Cloud repair_requests collection is empty.");
                            return;
                        }

                        const cloudRepairs = [];
                        snapshot.forEach((doc) => {
                            cloudRepairs.push({
                                ...doc.data(),
                                diagnoseId: doc.data().diagnoseId || doc.id,
                                id: doc.id
                            });
                        });

                        // Sort newest first
                        cloudRepairs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

                        localStorage.setItem('admin_repair_requests', JSON.stringify(cloudRepairs));
                        console.log(`🔥 [GUG Firebase] Synced ${cloudRepairs.length} repair requests from Cloud.`);
                        window.dispatchEvent(new CustomEvent('gugRepairsUpdated', { detail: cloudRepairs }));
                    }, (error) => {
                        console.warn("🔥 [GUG Firebase] Repairs live listener notice:", error.message);
                        this._fallbackFetchRepairs();
                    });
                    this._unsubscribers.push(unsub);
                    return;
                } catch (e) {
                    console.warn("[GUG Firebase] Error attaching repairs snapshot listener:", e);
                }
            }

            this._fallbackFetchRepairs();
        },

        async _fallbackFetchRepairs() {
            const cloudRepairs = await restGetCollection('repair_requests');
            if (cloudRepairs && cloudRepairs.length > 0) {
                cloudRepairs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
                localStorage.setItem('admin_repair_requests', JSON.stringify(cloudRepairs));
                window.dispatchEvent(new CustomEvent('gugRepairsUpdated', { detail: cloudRepairs }));
                console.log(`🔥 [GUG Firebase] Retrieved ${cloudRepairs.length} repair requests via REST.`);
            }
        },

        async updateRepairStatus(diagId, newStatus, diagnosisNotes) {
            const updates = { status: newStatus };
            if (diagnosisNotes !== undefined) updates.diagnosisNotes = diagnosisNotes;

            let repairs = JSON.parse(localStorage.getItem('admin_repair_requests') || '[]');
            let target = repairs.find(r => (r.diagnoseId || r.id) === diagId);
            if (target) {
                Object.assign(target, updates);
                localStorage.setItem('admin_repair_requests', JSON.stringify(repairs));
                window.dispatchEvent(new CustomEvent('gugRepairsUpdated', { detail: repairs }));
            }

            if (window.db) {
                try {
                    await window.db.collection('repair_requests').doc(diagId).set(updates, { merge: true });
                    console.log(`🔥 [GUG Firebase] Repair ${diagId} updated in Cloud.`);
                    return;
                } catch (e) {}
            }
            await restSetDoc('repair_requests', diagId, updates);
        },

        async deleteRepair(diagId) {
            let repairs = JSON.parse(localStorage.getItem('admin_repair_requests') || '[]');
            repairs = repairs.filter(r => (r.diagnoseId || r.id) !== diagId);
            localStorage.setItem('admin_repair_requests', JSON.stringify(repairs));
            window.dispatchEvent(new CustomEvent('gugRepairsUpdated', { detail: repairs }));

            if (window.db) {
                try {
                    await window.db.collection('repair_requests').doc(diagId).delete();
                    return;
                } catch (e) {}
            }
            await restDeleteDoc('repair_requests', diagId);
        },

        async getRepairById(diagId) {
            const cleanId = String(diagId).trim().toLowerCase();
            const localRepairs = JSON.parse(localStorage.getItem('admin_repair_requests') || '[]');
            const found = localRepairs.find(r => String(r.diagnoseId || r.id || '').trim().toLowerCase() === cleanId);
            if (found) return found;

            if (window.db) {
                try {
                    const doc = await window.db.collection('repair_requests').doc(diagId).get();
                    if (doc.exists) return { ...doc.data(), id: doc.id };
                } catch (e) {}
            }
            const cloudRepairs = await restGetCollection('repair_requests');
            return cloudRepairs.find(r => String(r.diagnoseId || r.id || '').trim().toLowerCase() === cleanId) || null;
        },

        // =========================================================
        // 3. CONTACT INQUIRIES SYNCHRONIZATION
        // =========================================================
        async saveContactInquiry(inquiry) {
            if (!inquiry) return;
            const inqId = String(inquiry.id || ('GUG-INQ-' + Math.floor(100000 + Math.random() * 900000)));
            const inqData = {
                ...inquiry,
                id: inqId,
                status: inquiry.status || 'New',
                archived: false,
                date: inquiry.date || new Date().toISOString(),
                createdAt: (typeof firebase !== 'undefined' && firebase.firestore) 
                    ? firebase.firestore.FieldValue.serverTimestamp() 
                    : new Date().toISOString()
            };

            // 1. Update local cache
            let localContacts = JSON.parse(localStorage.getItem('admin_contact_inquiries') || '[]');
            const existingIdx = localContacts.findIndex(c => c.id === inqId);
            if (existingIdx > -1) {
                localContacts[existingIdx] = { ...localContacts[existingIdx], ...inqData };
            } else {
                localContacts.unshift(inqData);
            }
            localStorage.setItem('admin_contact_inquiries', JSON.stringify(localContacts));
            window.dispatchEvent(new CustomEvent('gugContactsUpdated', { detail: localContacts }));

            // 2. Push to Cloud Firestore
            if (window.db && this.syncEnabled) {
                try {
                    await window.db.collection('contact_inquiries').doc(inqId).set(inqData, { merge: true });
                    console.log(`🔥 [GUG Firebase] Contact Inquiry ${inqId} saved to Cloud Firestore via SDK.`);
                    return;
                } catch (err) {
                    console.warn(`[GUG Firebase] SDK write failed for contact ${inqId}, falling back to REST:`, err.message);
                }
            }

            // Fallback: REST API
            const cleanRestData = { ...inqData, createdAt: new Date().toISOString() };
            await restSetDoc('contact_inquiries', inqId, cleanRestData);
            console.log(`🔥 [GUG Firebase] Contact Inquiry ${inqId} synced to cloud via REST API.`);
        },

        listenToContacts() {
            if (window.db) {
                try {
                    const unsub = window.db.collection('contact_inquiries').onSnapshot((snapshot) => {
                        if (snapshot.empty) {
                            console.log("🔥 [GUG Firebase] Cloud contact_inquiries collection is empty.");
                            return;
                        }

                        const cloudContacts = [];
                        snapshot.forEach((doc) => {
                            cloudContacts.push({
                                ...doc.data(),
                                id: doc.id
                            });
                        });

                        // Sort newest first
                        cloudContacts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

                        localStorage.setItem('admin_contact_inquiries', JSON.stringify(cloudContacts));
                        console.log(`🔥 [GUG Firebase] Synced ${cloudContacts.length} contact inquiries from Cloud.`);
                        window.dispatchEvent(new CustomEvent('gugContactsUpdated', { detail: cloudContacts }));
                    }, (error) => {
                        console.warn("🔥 [GUG Firebase] Contacts live listener notice:", error.message);
                        this._fallbackFetchContacts();
                    });
                    this._unsubscribers.push(unsub);
                    return;
                } catch (e) {
                    console.warn("[GUG Firebase] Error attaching contacts snapshot listener:", e);
                }
            }

            this._fallbackFetchContacts();
        },

        async _fallbackFetchContacts() {
            const cloudContacts = await restGetCollection('contact_inquiries');
            if (cloudContacts && cloudContacts.length > 0) {
                cloudContacts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
                localStorage.setItem('admin_contact_inquiries', JSON.stringify(cloudContacts));
                window.dispatchEvent(new CustomEvent('gugContactsUpdated', { detail: cloudContacts }));
                console.log(`🔥 [GUG Firebase] Retrieved ${cloudContacts.length} contact inquiries via REST.`);
            }
        },

        async updateContactStatus(inquiryId, status, archived) {
            const updates = {};
            if (status !== undefined) updates.status = status;
            if (archived !== undefined) updates.archived = archived;

            let contacts = JSON.parse(localStorage.getItem('admin_contact_inquiries') || '[]');
            let target = contacts.find(c => c.id === inquiryId);
            if (target) {
                Object.assign(target, updates);
                localStorage.setItem('admin_contact_inquiries', JSON.stringify(contacts));
                window.dispatchEvent(new CustomEvent('gugContactsUpdated', { detail: contacts }));
            }

            if (window.db) {
                try {
                    await window.db.collection('contact_inquiries').doc(inquiryId).set(updates, { merge: true });
                    return;
                } catch (e) {}
            }
            await restSetDoc('contact_inquiries', inquiryId, updates);
        },

        async deleteContact(inquiryId) {
            let contacts = JSON.parse(localStorage.getItem('admin_contact_inquiries') || '[]');
            contacts = contacts.filter(c => c.id !== inquiryId);
            localStorage.setItem('admin_contact_inquiries', JSON.stringify(contacts));
            window.dispatchEvent(new CustomEvent('gugContactsUpdated', { detail: contacts }));

            if (window.db) {
                try {
                    await window.db.collection('contact_inquiries').doc(inquiryId).delete();
                    return;
                } catch (e) {}
            }
            await restDeleteDoc('contact_inquiries', inquiryId);
        },

        // =========================================================
        // 4. DATA RECOVERY REQUESTS SYNCHRONIZATION
        // =========================================================
        async saveRecoveryRequest(recovery) {
            if (!recovery) return;
            const caseId = String(recovery.caseId || recovery.id || ('GUG-REC-' + Math.floor(100000 + Math.random() * 900000)));
            const recoveryData = {
                ...recovery,
                caseId: caseId,
                id: caseId,
                officeAddress: recovery.officeAddress || '',
                status: recovery.status || 'Pending Inspection',
                labNotes: recovery.labNotes || '',
                estimatedCost: recovery.estimatedCost || '',
                archived: false,
                date: recovery.date || new Date().toISOString(),
                createdAt: (typeof firebase !== 'undefined' && firebase.firestore) 
                    ? firebase.firestore.FieldValue.serverTimestamp() 
                    : new Date().toISOString()
            };

            // 1. Update local cache
            let localRecovery = JSON.parse(localStorage.getItem('admin_recovery_requests') || '[]');
            const existingIdx = localRecovery.findIndex(r => (r.caseId || r.id) === caseId);
            if (existingIdx > -1) {
                localRecovery[existingIdx] = { ...localRecovery[existingIdx], ...recoveryData };
            } else {
                localRecovery.unshift(recoveryData);
            }
            localStorage.setItem('admin_recovery_requests', JSON.stringify(localRecovery));
            window.dispatchEvent(new CustomEvent('gugRecoveryUpdated', { detail: localRecovery }));

            // 2. Push to Cloud Firestore
            if (window.db && this.syncEnabled) {
                try {
                    await window.db.collection('data_recovery_requests').doc(caseId).set(recoveryData, { merge: true });
                    console.log(`🔥 [GUG Firebase] Data Recovery Case ${caseId} saved to Cloud Firestore via SDK.`);
                    return;
                } catch (err) {
                    console.warn(`[GUG Firebase] SDK write failed for recovery ${caseId}, falling back to REST:`, err.message);
                }
            }

            // Fallback: REST API
            const cleanRestData = { ...recoveryData, createdAt: new Date().toISOString() };
            await restSetDoc('data_recovery_requests', caseId, cleanRestData);
            console.log(`🔥 [GUG Firebase] Data Recovery Case ${caseId} synced to cloud via REST API.`);
        },

        listenToRecovery() {
            if (window.db) {
                try {
                    const unsub = window.db.collection('data_recovery_requests').onSnapshot((snapshot) => {
                        if (snapshot.empty) {
                            console.log("🔥 [GUG Firebase] Cloud data_recovery_requests collection is empty.");
                            return;
                        }

                        const cloudRecovery = [];
                        snapshot.forEach((doc) => {
                            cloudRecovery.push({
                                ...doc.data(),
                                caseId: doc.data().caseId || doc.id,
                                id: doc.id
                            });
                        });

                        // Sort newest first
                        cloudRecovery.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

                        localStorage.setItem('admin_recovery_requests', JSON.stringify(cloudRecovery));
                        console.log(`🔥 [GUG Firebase] Synced ${cloudRecovery.length} data recovery cases from Cloud.`);
                        window.dispatchEvent(new CustomEvent('gugRecoveryUpdated', { detail: cloudRecovery }));
                    }, (error) => {
                        console.warn("🔥 [GUG Firebase] Recovery live listener notice:", error.message);
                        this._fallbackFetchRecovery();
                    });
                    this._unsubscribers.push(unsub);
                    return;
                } catch (e) {
                    console.warn("[GUG Firebase] Error attaching recovery snapshot listener:", e);
                }
            }

            this._fallbackFetchRecovery();
        },

        async _fallbackFetchRecovery() {
            const cloudRecovery = await restGetCollection('data_recovery_requests');
            if (cloudRecovery && cloudRecovery.length > 0) {
                cloudRecovery.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
                localStorage.setItem('admin_recovery_requests', JSON.stringify(cloudRecovery));
                window.dispatchEvent(new CustomEvent('gugRecoveryUpdated', { detail: cloudRecovery }));
                console.log(`🔥 [GUG Firebase] Retrieved ${cloudRecovery.length} data recovery cases via REST.`);
            }
        },

        async updateRecoveryStatus(caseId, newStatus, labNotes, estimatedCost) {
            const updates = { status: newStatus };
            if (labNotes !== undefined) updates.labNotes = labNotes;
            if (estimatedCost !== undefined) updates.estimatedCost = estimatedCost;

            let recoveries = JSON.parse(localStorage.getItem('admin_recovery_requests') || '[]');
            let target = recoveries.find(r => (r.caseId || r.id) === caseId);
            if (target) {
                Object.assign(target, updates);
                localStorage.setItem('admin_recovery_requests', JSON.stringify(recoveries));
                window.dispatchEvent(new CustomEvent('gugRecoveryUpdated', { detail: recoveries }));
            }

            if (window.db) {
                try {
                    await window.db.collection('data_recovery_requests').doc(caseId).set(updates, { merge: true });
                    console.log(`🔥 [GUG Firebase] Recovery Case ${caseId} updated in Cloud.`);
                    return;
                } catch (e) {}
            }
            await restSetDoc('data_recovery_requests', caseId, updates);
        },

        async deleteRecovery(caseId) {
            let recoveries = JSON.parse(localStorage.getItem('admin_recovery_requests') || '[]');
            recoveries = recoveries.filter(r => (r.caseId || r.id) !== caseId);
            localStorage.setItem('admin_recovery_requests', JSON.stringify(recoveries));
            window.dispatchEvent(new CustomEvent('gugRecoveryUpdated', { detail: recoveries }));

            if (window.db) {
                try {
                    await window.db.collection('data_recovery_requests').doc(caseId).delete();
                    return;
                } catch (e) {}
            }
            await restDeleteDoc('data_recovery_requests', caseId);
        },

        async getRecoveryById(caseId) {
            const cleanId = String(caseId).trim().toLowerCase();
            const localRecoveries = JSON.parse(localStorage.getItem('admin_recovery_requests') || '[]');
            const found = localRecoveries.find(r => String(r.caseId || r.id || '').trim().toLowerCase() === cleanId);
            if (found) return found;

            if (window.db) {
                try {
                    const doc = await window.db.collection('data_recovery_requests').doc(caseId).get();
                    if (doc.exists) return { ...doc.data(), id: doc.id };
                } catch (e) {}
            }
            const cloudRecoveries = await restGetCollection('data_recovery_requests');
            return cloudRecoveries.find(r => String(r.caseId || r.id || '').trim().toLowerCase() === cleanId) || null;
        },

        // =========================================================
        // 4B. CUSTOM PC BUILD REQUESTS SYNCHRONIZATION
        // =========================================================
        async savePcBuildRequest(build) {
            if (!build) return;
            const buildId = String(build.buildId || build.id || ('GUG-PC-' + Math.floor(100000 + Math.random() * 900000)));
            const buildData = {
                ...build,
                buildId: buildId,
                id: buildId,
                category: build.category || build.buildTier || 'Custom PC',
                buildTier: build.buildTier || build.category || 'Custom PC',
                status: build.status || 'New Lead',
                salesNotes: build.salesNotes || '',
                archived: false,
                date: build.date || new Date().toISOString(),
                createdAt: (typeof firebase !== 'undefined' && firebase.firestore) 
                    ? firebase.firestore.FieldValue.serverTimestamp() 
                    : new Date().toISOString()
            };

            // 1. Update local cache
            let localBuilds = JSON.parse(localStorage.getItem('admin_pc_build_requests') || '[]');
            const existingIdx = localBuilds.findIndex(b => (b.buildId || b.id) === buildId);
            if (existingIdx > -1) {
                localBuilds[existingIdx] = { ...localBuilds[existingIdx], ...buildData };
            } else {
                localBuilds.unshift(buildData);
            }
            localStorage.setItem('admin_pc_build_requests', JSON.stringify(localBuilds));
            window.dispatchEvent(new CustomEvent('gugPcBuildsUpdated', { detail: localBuilds }));
            window.dispatchEvent(new Event('pcBuildsReady'));

            // 2. Push to Cloud Firestore
            if (window.db && this.syncEnabled) {
                try {
                    await window.db.collection('pc_build_requests').doc(buildId).set(buildData, { merge: true });
                    console.log(`🔥 [GUG Firebase] Custom PC Build Request ${buildId} saved to Cloud Firestore via SDK.`);
                    return;
                } catch (err) {
                    console.warn(`[GUG Firebase] SDK write failed for PC build ${buildId}, falling back to REST:`, err.message);
                }
            }

            // Fallback: REST API
            const cleanRestData = { ...buildData, createdAt: new Date().toISOString() };
            await restSetDoc('pc_build_requests', buildId, cleanRestData);
            console.log(`🔥 [GUG Firebase] Custom PC Build Request ${buildId} synced to cloud via REST API.`);
        },

        listenToPcBuilds() {
            if (window.db) {
                try {
                    const unsub = window.db.collection('pc_build_requests').onSnapshot((snapshot) => {
                        if (snapshot.empty) {
                            console.log("🔥 [GUG Firebase] Cloud pc_build_requests collection is empty.");
                            return;
                        }

                        const cloudBuilds = [];
                        snapshot.forEach((doc) => {
                            cloudBuilds.push({
                                ...doc.data(),
                                buildId: doc.data().buildId || doc.id,
                                id: doc.id
                            });
                        });

                        // Sort newest first
                        cloudBuilds.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

                        localStorage.setItem('admin_pc_build_requests', JSON.stringify(cloudBuilds));
                        console.log(`🔥 [GUG Firebase] Synced ${cloudBuilds.length} custom PC build requests from Cloud.`);
                        window.dispatchEvent(new CustomEvent('gugPcBuildsUpdated', { detail: cloudBuilds }));
                        window.dispatchEvent(new Event('pcBuildsReady'));
                    }, (error) => {
                        console.warn("🔥 [GUG Firebase] PC builds live listener notice:", error.message);
                        this._fallbackFetchPcBuilds();
                    });
                    this._unsubscribers.push(unsub);
                    return;
                } catch (e) {
                    console.warn("[GUG Firebase] Error attaching PC builds snapshot listener:", e);
                }
            }

            this._fallbackFetchPcBuilds();
        },

        async _fallbackFetchPcBuilds() {
            const cloudBuilds = await restGetCollection('pc_build_requests');
            if (cloudBuilds && cloudBuilds.length > 0) {
                cloudBuilds.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
                localStorage.setItem('admin_pc_build_requests', JSON.stringify(cloudBuilds));
                window.dispatchEvent(new CustomEvent('gugPcBuildsUpdated', { detail: cloudBuilds }));
                window.dispatchEvent(new Event('pcBuildsReady'));
                console.log(`🔥 [GUG Firebase] Retrieved ${cloudBuilds.length} custom PC build requests via REST.`);
            }
        },

        async updatePcBuildStatus(buildId, newStatus, salesNotes) {
            const updates = { status: newStatus };
            if (salesNotes !== undefined) updates.salesNotes = salesNotes;

            let builds = JSON.parse(localStorage.getItem('admin_pc_build_requests') || '[]');
            let target = builds.find(b => (b.buildId || b.id) === buildId);
            if (target) {
                Object.assign(target, updates);
                localStorage.setItem('admin_pc_build_requests', JSON.stringify(builds));
                window.dispatchEvent(new CustomEvent('gugPcBuildsUpdated', { detail: builds }));
            }

            if (window.db) {
                try {
                    await window.db.collection('pc_build_requests').doc(buildId).set(updates, { merge: true });
                    console.log(`🔥 [GUG Firebase] PC Build ${buildId} updated in Cloud.`);
                    return;
                } catch (e) {}
            }
            await restSetDoc('pc_build_requests', buildId, updates);
        },

        async deletePcBuild(buildId) {
            let builds = JSON.parse(localStorage.getItem('admin_pc_build_requests') || '[]');
            builds = builds.filter(b => (b.buildId || b.id) !== buildId);
            localStorage.setItem('admin_pc_build_requests', JSON.stringify(builds));
            window.dispatchEvent(new CustomEvent('gugPcBuildsUpdated', { detail: builds }));

            if (window.db) {
                try {
                    await window.db.collection('pc_build_requests').doc(buildId).delete();
                    return;
                } catch (e) {}
            }
            await restDeleteDoc('pc_build_requests', buildId);
        },

        // =========================================================
        // 5. CATALOG PRODUCTS SYNCHRONIZATION
        // =========================================================
        listenToProducts() {
            if (window.db) {
                try {
                    const unsub = window.db.collection('products').onSnapshot((snapshot) => {
                        if (snapshot.empty) {
                            console.log("🔥 [GUG Firebase] Cloud products collection is empty. Local catalog remains active.");
                            return;
                        }

                        const cloudProducts = [];
                        snapshot.forEach((doc) => {
                            const data = doc.data();
                            cloudProducts.push({
                                ...data,
                                id: doc.id,
                                numericId: data.numericId || doc.id
                            });
                        });

                        console.log(`🔥 [GUG Firebase] Synced ${cloudProducts.length} live products from Cloud Firestore.`);
                        
                        let existingProds = [];
                        try {
                            existingProds = JSON.parse(localStorage.getItem('gug_erp_products') || '[]');
                        } catch(e) {}
                        if (!Array.isArray(existingProds) || existingProds.length === 0) {
                            if (window.PRODUCTS_DATA && window.PRODUCTS_DATA.length > 0) {
                                existingProds = [...window.PRODUCTS_DATA];
                            }
                        }

                        // Merge cloud updates into local product catalog
                        cloudProducts.forEach(cp => {
                            const idx = existingProds.findIndex(p => p.id === cp.id || (cp.sku && p.sku === cp.sku));
                            if (idx !== -1) {
                                existingProds[idx] = { ...existingProds[idx], ...cp };
                            } else {
                                existingProds.unshift(cp);
                            }
                        });

                        localStorage.setItem('gug_erp_products', JSON.stringify(existingProds));

                        if (window.GUG_DB && typeof window.GUG_DB.getStorefrontProducts === 'function') {
                            if (typeof window.GUG_DB.invalidateProductCache === 'function') {
                                window.GUG_DB.invalidateProductCache();
                            }
                            window.PRODUCTS_DATA = window.GUG_DB.getStorefrontProducts();
                        } else {
                            window.PRODUCTS_DATA = existingProds;
                        }

                        window.dispatchEvent(new Event('productsReady'));
                        window.dispatchEvent(new CustomEvent('gugCatalogUpdated', { detail: existingProds }));
                    }, (error) => {
                        console.warn("🔥 [GUG Firebase] Products sync notice:", error.message);
                    });
                    this._unsubscribers.push(unsub);
                } catch (e) {}
            }
        },

        async saveProduct(product) {
            if (!product || !this.syncEnabled) return;
            const docId = String(product.id || ('PROD-' + Date.now()));
            if (window.db) {
                try {
                    await window.db.collection('products').doc(docId).set(product, { merge: true });
                    console.log(`🔥 [GUG Firebase] Product ${docId} synced to cloud.`);
                    return;
                } catch (err) {
                    console.error(`🔥 [GUG Firebase] Failed to save product ${docId}:`, err);
                }
            }
            await restSetDoc('products', docId, product);
        },

        async deleteProduct(productId) {
            if (!productId || !this.syncEnabled) return;
            const docId = String(productId);
            if (window.db) {
                try {
                    await window.db.collection('products').doc(docId).delete();
                    console.log(`🔥 [GUG Firebase] Product ${docId} deleted from cloud.`);
                    return;
                } catch (err) {
                    console.error(`🔥 [GUG Firebase] Failed to delete product ${docId}:`, err);
                }
            }
            await restDeleteDoc('products', docId);
        },

        async uploadLocalCatalogToFirebase() {
            if (!window.db) {
                alert("Firebase is initializing. Please wait a few seconds and try again.");
                return;
            }

            const products = (window.GUG_DB && typeof window.GUG_DB.getProducts === 'function')
                ? window.GUG_DB.getProducts()
                : (JSON.parse(localStorage.getItem('gug_erp_products') || '[]'));

            if (!products || products.length === 0) {
                alert("No local products found to migrate.");
                return;
            }

            const confirmUpload = confirm(`Are you sure you want to upload all ${products.length} products to Cloud Firestore?`);
            if (!confirmUpload) return;

            console.log(`🔥 [GUG Firebase] Starting batch upload of ${products.length} products...`);
            let count = 0;
            const batchSize = 400;
            
            for (let i = 0; i < products.length; i += batchSize) {
                const chunk = products.slice(i, i + batchSize);
                const batch = window.db.batch();
                
                chunk.forEach(p => {
                    const docRef = window.db.collection('products').doc(String(p.id));
                    batch.set(docRef, p, { merge: true });
                    count++;
                });

                await batch.commit();
                console.log(`🔥 [GUG Firebase] Uploaded batch ${Math.min(i + batchSize, products.length)} / ${products.length}`);
            }

            alert(`✅ Success! Successfully uploaded ${count} products to Cloud Firestore.`);
        },

        // =========================================================
        // 6. EMPLOYEES / HR WORKFORCE SYNCHRONIZATION
        // =========================================================
        async saveEmployee(employee) {
            if (!employee || !this.syncEnabled) return;
            const empId = String(employee.id || ('EMP-' + Date.now()));
            const empData = {
                ...employee,
                id: empId,
                updatedAt: (typeof firebase !== 'undefined' && firebase.firestore)
                    ? firebase.firestore.FieldValue.serverTimestamp()
                    : new Date().toISOString()
            };

            // 1. Update local cache (gug_erp_employees)
            try {
                let localEmps = JSON.parse(localStorage.getItem('gug_erp_employees') || '[]');
                const idx = localEmps.findIndex(e => e.id === empId || (employee.username && e.username && e.username.toLowerCase() === employee.username.toLowerCase()));
                if (idx > -1) {
                    localEmps[idx] = { ...localEmps[idx], ...empData };
                } else {
                    localEmps.push(empData);
                }
                localStorage.setItem('gug_erp_employees', JSON.stringify(localEmps));
                window.dispatchEvent(new CustomEvent('gugEmployeesUpdated', { detail: localEmps }));
                window.dispatchEvent(new Event('employeesReady'));
            } catch (e) {
                console.warn('[GUG Firebase] Error updating local employee cache:', e);
            }

            // 2. Push to Cloud Firestore
            if (window.db) {
                try {
                    await window.db.collection('employees').doc(empId).set(empData, { merge: true });
                    console.log(`🔥 [GUG Firebase] Employee ${empId} synced to Cloud Firestore.`);
                    return;
                } catch (err) {
                    console.warn(`[GUG Firebase] SDK write failed for employee ${empId}, falling back to REST:`, err.message);
                }
            }

            // Fallback: REST API
            const cleanRestData = { ...empData, updatedAt: new Date().toISOString() };
            await restSetDoc('employees', empId, cleanRestData);
            console.log(`🔥 [GUG Firebase] Employee ${empId} synced to cloud via REST API.`);
        },

        async deleteEmployee(empId) {
            if (!empId || !this.syncEnabled) return;
            const cleanId = String(empId);

            // Record in admin_deleted_employees
            try {
                let deletedEmps = JSON.parse(localStorage.getItem('admin_deleted_employees') || '[]');
                if (!deletedEmps.includes(cleanId)) deletedEmps.push(cleanId);
                if (!deletedEmps.includes(cleanId.toLowerCase())) deletedEmps.push(cleanId.toLowerCase());
                localStorage.setItem('admin_deleted_employees', JSON.stringify(deletedEmps));
            } catch(e) {}

            // 1. Update local cache
            try {
                let localEmps = JSON.parse(localStorage.getItem('gug_erp_employees') || '[]');
                localEmps = localEmps.filter(e => e.id !== cleanId);
                localStorage.setItem('gug_erp_employees', JSON.stringify(localEmps));
                window.dispatchEvent(new CustomEvent('gugEmployeesUpdated', { detail: localEmps }));
                window.dispatchEvent(new Event('employeesReady'));
            } catch (e) {}

            // 2. Remove from Cloud Firestore
            if (window.db) {
                try {
                    await window.db.collection('employees').doc(cleanId).delete();
                    console.log(`🔥 [GUG Firebase] Employee ${cleanId} deleted from Cloud Firestore.`);
                    return;
                } catch (err) {
                    console.warn(`[GUG Firebase] SDK delete failed for employee ${cleanId}:`, err.message);
                }
            }

            await restDeleteDoc('employees', cleanId);
            console.log(`🔥 [GUG Firebase] Employee ${cleanId} deleted via REST API.`);
        },

        listenToEmployees() {
            if (window.db) {
                try {
                    const unsub = window.db.collection('employees').onSnapshot((snapshot) => {
                        if (snapshot.empty) {
                            console.log("🔥 [GUG Firebase] Cloud employees collection is empty. Local workforce records active.");
                            return;
                        }

                        const cloudEmps = [];
                        snapshot.forEach((doc) => {
                            cloudEmps.push({
                                ...doc.data(),
                                id: doc.id
                            });
                        });

                        this._mergeEmployees(cloudEmps);
                    }, (error) => {
                        console.warn("🔥 [GUG Firebase] Employees live listener notice:", error.message);
                        this._fallbackFetchEmployees();
                    });
                    this._unsubscribers.push(unsub);
                    return;
                } catch (e) {
                    console.warn("[GUG Firebase] Error attaching employees snapshot listener:", e);
                }
            }

            this._fallbackFetchEmployees();
        },

        async _fallbackFetchEmployees() {
            const cloudEmps = await restGetCollection('employees');
            if (cloudEmps && cloudEmps.length > 0) {
                this._mergeEmployees(cloudEmps);
                console.log(`🔥 [GUG Firebase] Retrieved ${cloudEmps.length} employees via REST.`);
            }
        },

        _mergeEmployees(cloudEmps) {
            let deletedEmps = [];
            try {
                deletedEmps = JSON.parse(localStorage.getItem('admin_deleted_employees') || '[]').map(s => String(s).toLowerCase());
            } catch(e) { deletedEmps = []; }

            let localEmps = JSON.parse(localStorage.getItem('gug_erp_employees') || '[]');
            const empMap = new Map();
            localEmps.forEach(e => {
                if (e && e.id && !deletedEmps.includes(String(e.id).toLowerCase()) && (!e.username || !deletedEmps.includes(String(e.username).toLowerCase()))) {
                    empMap.set(e.id, e);
                }
            });
            cloudEmps.forEach(ce => {
                if (ce && ce.id && !deletedEmps.includes(String(ce.id).toLowerCase()) && (!ce.username || !deletedEmps.includes(String(ce.username).toLowerCase()))) {
                    const existing = empMap.get(ce.id) || {};
                    empMap.set(ce.id, { ...existing, ...ce });
                } else if (ce && ce.id && deletedEmps.includes(String(ce.id).toLowerCase())) {
                    // Permanently purge from Cloud Firestore
                    this.deleteEmployee(ce.id);
                }
            });
            const merged = Array.from(empMap.values());
            localStorage.setItem('gug_erp_employees', JSON.stringify(merged));
            console.log(`🔥 [GUG Firebase] Synced ${merged.length} workforce records (${cloudEmps.length} from Cloud).`);
            window.dispatchEvent(new CustomEvent('gugEmployeesUpdated', { detail: merged }));
            window.dispatchEvent(new Event('employeesReady'));
        },

        // =========================================================
        // 7. B2B DEALERS SYNCHRONIZATION
        // =========================================================
        async saveDealer(dealer) {
            if (!dealer || !this.syncEnabled) return;
            const dealerId = String(dealer.id || ('DLR-' + Date.now()));
            const dealerData = {
                ...dealer,
                id: dealerId,
                updatedAt: (typeof firebase !== 'undefined' && firebase.firestore)
                    ? firebase.firestore.FieldValue.serverTimestamp()
                    : new Date().toISOString()
            };

            // 1. Update local cache (gug_erp_dealers)
            try {
                let localDealers = JSON.parse(localStorage.getItem('gug_erp_dealers') || '[]');
                const idx = localDealers.findIndex(d => d.id === dealerId || (dealer.username && d.username && d.username.toLowerCase() === dealer.username.toLowerCase()));
                if (idx > -1) {
                    localDealers[idx] = { ...localDealers[idx], ...dealerData };
                } else {
                    localDealers.push(dealerData);
                }
                localStorage.setItem('gug_erp_dealers', JSON.stringify(localDealers));
                window.dispatchEvent(new CustomEvent('gugDealersUpdated', { detail: localDealers }));
                window.dispatchEvent(new Event('dealersReady'));
            } catch (e) {
                console.warn('[GUG Firebase] Error updating local dealer cache:', e);
            }

            // 2. Push to Cloud Firestore
            if (window.db) {
                try {
                    await window.db.collection('dealers').doc(dealerId).set(dealerData, { merge: true });
                    console.log(`🔥 [GUG Firebase] Dealer ${dealerId} synced to Cloud Firestore.`);
                    return;
                } catch (err) {
                    console.warn(`[GUG Firebase] SDK write failed for dealer ${dealerId}, falling back to REST:`, err.message);
                }
            }

            // Fallback: REST API
            const cleanRestData = { ...dealerData, updatedAt: new Date().toISOString() };
            await restSetDoc('dealers', dealerId, cleanRestData);
            console.log(`🔥 [GUG Firebase] Dealer ${dealerId} synced to cloud via REST API.`);
        },

        async deleteDealer(dealerId) {
            if (!dealerId || !this.syncEnabled) return;
            const cleanId = String(dealerId);

            // 1. Update local cache
            try {
                let localDealers = JSON.parse(localStorage.getItem('gug_erp_dealers') || '[]');
                localDealers = localDealers.filter(d => d.id !== cleanId);
                localStorage.setItem('gug_erp_dealers', JSON.stringify(localDealers));
                window.dispatchEvent(new CustomEvent('gugDealersUpdated', { detail: localDealers }));
                window.dispatchEvent(new Event('dealersReady'));
            } catch (e) {}

            // 2. Remove from Cloud Firestore
            if (window.db) {
                try {
                    await window.db.collection('dealers').doc(cleanId).delete();
                    console.log(`🔥 [GUG Firebase] Dealer ${cleanId} deleted from Cloud Firestore.`);
                    return;
                } catch (err) {
                    console.warn(`[GUG Firebase] SDK delete failed for dealer ${cleanId}:`, err.message);
                }
            }

            await restDeleteDoc('dealers', cleanId);
            console.log(`🔥 [GUG Firebase] Dealer ${cleanId} deleted via REST API.`);
        },

        listenToDealers() {
            if (window.db) {
                try {
                    const unsub = window.db.collection('dealers').onSnapshot((snapshot) => {
                        if (snapshot.empty) {
                            console.log("🔥 [GUG Firebase] Cloud dealers collection is empty. Local dealer records active.");
                            return;
                        }

                        const cloudDealers = [];
                        snapshot.forEach((doc) => {
                            cloudDealers.push({
                                ...doc.data(),
                                id: doc.id
                            });
                        });

                        this._mergeDealers(cloudDealers);
                    }, (error) => {
                        console.warn("🔥 [GUG Firebase] Dealers live listener notice:", error.message);
                        this._fallbackFetchDealers();
                    });
                    this._unsubscribers.push(unsub);
                    return;
                } catch (e) {
                    console.warn("[GUG Firebase] Error attaching dealers snapshot listener:", e);
                }
            }

            this._fallbackFetchDealers();
        },

        async _fallbackFetchDealers() {
            const cloudDealers = await restGetCollection('dealers');
            if (cloudDealers && cloudDealers.length > 0) {
                this._mergeDealers(cloudDealers);
                console.log(`🔥 [GUG Firebase] Retrieved ${cloudDealers.length} dealers via REST.`);
            }
        },

        _mergeDealers(cloudDealers) {
            let localDealers = JSON.parse(localStorage.getItem('gug_erp_dealers') || '[]');
            const dMap = new Map();
            localDealers.forEach(d => dMap.set(d.id, d));
            cloudDealers.forEach(cd => {
                const existing = dMap.get(cd.id) || {};
                dMap.set(cd.id, { ...existing, ...cd });
            });
            const merged = Array.from(dMap.values());
            localStorage.setItem('gug_erp_dealers', JSON.stringify(merged));
            console.log(`🔥 [GUG Firebase] Synced ${merged.length} dealer records (${cloudDealers.length} from Cloud).`);
            window.dispatchEvent(new CustomEvent('gugDealersUpdated', { detail: merged }));
            window.dispatchEvent(new Event('dealersReady'));
        },

        // =========================================================
        // 9. SITE THEME & FOOTER SETTINGS CLOUD SYNCHRONIZATION
        // =========================================================
        async saveThemeConfig(config) {
            if (!config) return;
            const payload = { ...config, updatedAt: config.updatedAt || Date.now() };
            try {
                if (window.db) {
                    await window.db.collection('site_settings').doc('theme_config').set(payload, { merge: true });
                    console.log("☁️ [GUG Firebase] Live Theme & Footer settings successfully synced to Cloud Firestore.");
                    return;
                }
            } catch (err) {
                console.warn("[GUG Firebase] SDK write failed, falling back to REST API for theme config:", err.message);
            }

            try {
                await restSetDoc('site_settings', 'theme_config', payload);
                console.log("☁️ [GUG Firebase] Live Theme & Footer settings successfully synced via REST API.");
            } catch (err2) {
                console.warn("[GUG Firebase] REST fallback write error for theme config:", err2);
            }
        },

        listenToThemeConfig() {
            try {
                if (window.db) {
                    const unsub = window.db.collection('site_settings').doc('theme_config').onSnapshot((doc) => {
                        if (doc && doc.exists) {
                            const cloudCfg = doc.data();
                            this.applyCloudThemeConfig(cloudCfg);
                        }
                    }, (err) => {
                        console.warn("[GUG Firebase] Theme listener notice (using REST fallback):", err);
                        this.fetchThemeConfigREST();
                    });
                    this._unsubscribers.push(unsub);
                } else {
                    this.fetchThemeConfigREST();
                }
            } catch(e) {
                this.fetchThemeConfigREST();
            }
        },

        async fetchThemeConfigREST() {
            try {
                const cloudDoc = await restGetDoc('site_settings', 'theme_config');
                if (cloudDoc) {
                    this.applyCloudThemeConfig(cloudDoc);
                }
            } catch(e) {}
        },

        applyCloudThemeConfig(cloudCfg) {
            if (!cloudCfg) return;
            const localCfg = JSON.parse(localStorage.getItem('gug_event_theme_config') || '{}');

            // If local settings were updated more recently than cloud snapshot, prevent overwrite
            if (localCfg.updatedAt && cloudCfg.updatedAt && Number(cloudCfg.updatedAt) < Number(localCfg.updatedAt)) {
                console.log("☁️ [GUG Firebase] Local theme config is more recent than cloud doc, skipping overwrite.");
                return;
            }

            const merged = Object.assign({}, localCfg, cloudCfg);
            // Protect local background image from being blanked if cloud document omitted it
            if (!cloudCfg.bgImage && localCfg.bgImage && (cloudCfg.bgType === 'image' || (!cloudCfg.bgType && localCfg.bgType === 'image'))) {
                merged.bgImage = localCfg.bgImage;
            }

            localStorage.setItem('gug_event_theme_config', JSON.stringify(merged));
            window.dispatchEvent(new CustomEvent('gugThemeUpdated', { detail: merged }));
            window.dispatchEvent(new Event('storage'));
            if (typeof window.applyGlobalTheme === 'function') {
                window.applyGlobalTheme();
            }
            if (typeof window.injectFooter === 'function') {
                window.injectFooter();
            }
            if (typeof window.injectHeader === 'function') {
                window.injectHeader();
            }
            if (typeof window.updateLiveThemePreview === 'function') {
                window.updateLiveThemePreview();
            }
        },

        // =========================================================
        // 8. BRIDGE TO GUG ERP CORE ENGINE
        // =========================================================
        patchErpCore() {
            if (!window.GUG_DB) return;

            // Hook product saves
            const origSaveProduct = window.GUG_DB.saveProduct ? window.GUG_DB.saveProduct.bind(window.GUG_DB) : null;
            if (origSaveProduct && !window.GUG_DB._firebasePatched) {
                window.GUG_DB.saveProduct = (productData) => {
                    const result = origSaveProduct(productData);
                    window.GUG_FIREBASE.saveProduct(productData);
                    return result;
                };

                const origDeleteProduct = window.GUG_DB.deleteProduct ? window.GUG_DB.deleteProduct.bind(window.GUG_DB) : null;
                if (origDeleteProduct) {
                    window.GUG_DB.deleteProduct = (id) => {
                        const result = origDeleteProduct(id);
                        window.GUG_FIREBASE.deleteProduct(id);
                        return result;
                    };
                }

                // Hook order creation
                const origProcessOrder = window.GUG_DB.processStorefrontOrder ? window.GUG_DB.processStorefrontOrder.bind(window.GUG_DB) : null;
                if (origProcessOrder) {
                    window.GUG_DB.processStorefrontOrder = (orderData) => {
                        const result = origProcessOrder(orderData);
                        window.GUG_FIREBASE.saveOrder(result || orderData);
                        return result;
                    };
                }

                // Hook order status change
                const origUpdateOrderStatus = window.GUG_DB.updateOrderStatus ? window.GUG_DB.updateOrderStatus.bind(window.GUG_DB) : null;
                if (origUpdateOrderStatus) {
                    window.GUG_DB.updateOrderStatus = (orderId, newStatus, reason) => {
                        const result = origUpdateOrderStatus(orderId, newStatus, reason);
                        window.GUG_FIREBASE.updateOrderStatus(orderId, newStatus);
                        return result;
                    };
                }

                // Hook employee save
                const origSaveEmployee = window.GUG_DB.saveEmployee ? window.GUG_DB.saveEmployee.bind(window.GUG_DB) : null;
                if (origSaveEmployee) {
                    window.GUG_DB.saveEmployee = (empData) => {
                        const result = origSaveEmployee(empData);
                        if (result && result.success && result.employee) {
                            window.GUG_FIREBASE.saveEmployee(result.employee);
                        } else if (result && result.success) {
                            window.GUG_FIREBASE.saveEmployee(empData);
                        }
                        return result;
                    };
                }

                // Hook employee delete
                const origDeleteEmployee = window.GUG_DB.deleteEmployee ? window.GUG_DB.deleteEmployee.bind(window.GUG_DB) : null;
                if (origDeleteEmployee) {
                    window.GUG_DB.deleteEmployee = (id) => {
                        const result = origDeleteEmployee(id);
                        if (result && result.success) {
                            window.GUG_FIREBASE.deleteEmployee(id);
                        }
                        return result;
                    };
                }

                // Hook employee status toggle
                const origToggleStatus = window.GUG_DB.toggleEmployeeStatus ? window.GUG_DB.toggleEmployeeStatus.bind(window.GUG_DB) : null;
                if (origToggleStatus) {
                    window.GUG_DB.toggleEmployeeStatus = (id) => {
                        const result = origToggleStatus(id);
                        if (result && result.success && result.employee) {
                            window.GUG_FIREBASE.saveEmployee(result.employee);
                        }
                        return result;
                    };
                }

                // Hook employee password reset
                const origResetPw = window.GUG_DB.resetEmployeePassword ? window.GUG_DB.resetEmployeePassword.bind(window.GUG_DB) : null;
                if (origResetPw) {
                    window.GUG_DB.resetEmployeePassword = (id, newPw) => {
                        const result = origResetPw(id, newPw);
                        if (result && result.success) {
                            const emp = window.GUG_DB.getEmployeeById(id);
                            if (emp) window.GUG_FIREBASE.saveEmployee(emp);
                        }
                        return result;
                    };
                }

                // Hook dealer save
                const origSaveDealer = window.GUG_DB.saveDealer ? window.GUG_DB.saveDealer.bind(window.GUG_DB) : null;
                if (origSaveDealer) {
                    window.GUG_DB.saveDealer = (dealerData) => {
                        const result = origSaveDealer(dealerData);
                        if (result && result.success && result.dealer) {
                            window.GUG_FIREBASE.saveDealer(result.dealer);
                        } else if (result && result.success) {
                            window.GUG_FIREBASE.saveDealer(dealerData);
                        }
                        return result;
                    };
                }

                // Hook dealer delete
                const origDeleteDealer = window.GUG_DB.deleteDealer ? window.GUG_DB.deleteDealer.bind(window.GUG_DB) : null;
                if (origDeleteDealer) {
                    window.GUG_DB.deleteDealer = (id) => {
                        const result = origDeleteDealer(id);
                        if (result && result.success) {
                            window.GUG_FIREBASE.deleteDealer(id);
                        }
                        return result;
                    };
                }

                // Hook dealer status toggle
                const origToggleDealerStatus = window.GUG_DB.toggleDealerStatus ? window.GUG_DB.toggleDealerStatus.bind(window.GUG_DB) : null;
                if (origToggleDealerStatus) {
                    window.GUG_DB.toggleDealerStatus = (id) => {
                        const result = origToggleDealerStatus(id);
                        if (result && result.success) {
                            const dealer = window.GUG_DB.getDealerById(id);
                            if (dealer) window.GUG_FIREBASE.saveDealer(dealer);
                        }
                        return result;
                    };
                }

                // Hook dealer password reset
                const origResetDealerPw = window.GUG_DB.resetDealerPassword ? window.GUG_DB.resetDealerPassword.bind(window.GUG_DB) : null;
                if (origResetDealerPw) {
                    window.GUG_DB.resetDealerPassword = (id, newPw) => {
                        const result = origResetDealerPw(id, newPw);
                        if (result && result.success) {
                            const dealer = window.GUG_DB.getDealerById(id);
                            if (dealer) window.GUG_FIREBASE.saveDealer(dealer);
                        }
                        return result;
                    };
                }

                // Hook product save
                const origSaveProduct = window.GUG_DB.saveProduct ? window.GUG_DB.saveProduct.bind(window.GUG_DB) : null;
                if (origSaveProduct) {
                    window.GUG_DB.saveProduct = (productData) => {
                        const result = origSaveProduct(productData);
                        if (result && result.success && result.product) {
                            window.GUG_FIREBASE.saveProduct(result.product);
                        } else if (result && result.success) {
                            window.GUG_FIREBASE.saveProduct(productData);
                        }
                        return result;
                    };
                }

                // Hook product delete
                const origDeleteProduct = window.GUG_DB.deleteProduct ? window.GUG_DB.deleteProduct.bind(window.GUG_DB) : null;
                if (origDeleteProduct) {
                    window.GUG_DB.deleteProduct = (id) => {
                        const result = origDeleteProduct(id);
                        if (result && result.success) {
                            window.GUG_FIREBASE.deleteProduct(id);
                        }
                        return result;
                    };
                }

                window.GUG_DB._firebasePatched = true;
                console.log("🔥 [GUG Firebase] GugErpCore successfully hooked into Firebase real-time pipeline.");
            }

            // Expose helper getters on GUG_DB for seamless access
            if (!window.GUG_DB.getRepairRequests) {
                window.GUG_DB.getRepairRequests = () => JSON.parse(localStorage.getItem('admin_repair_requests') || '[]');
            }
            if (!window.GUG_DB.getContactInquiries) {
                window.GUG_DB.getContactInquiries = () => JSON.parse(localStorage.getItem('admin_contact_inquiries') || '[]');
            }
            if (!window.GUG_DB.saveRepairRequest) {
                window.GUG_DB.saveRepairRequest = (r) => window.GUG_FIREBASE.saveRepairRequest(r);
            }
            if (!window.GUG_DB.saveContactInquiry) {
                window.GUG_DB.saveContactInquiry = (c) => window.GUG_FIREBASE.saveContactInquiry(c);
            }
            if (!window.GUG_DB.getRecoveryRequests) {
                window.GUG_DB.getRecoveryRequests = () => JSON.parse(localStorage.getItem('admin_recovery_requests') || '[]');
            }
            if (!window.GUG_DB.saveRecoveryRequest) {
                window.GUG_DB.saveRecoveryRequest = (rec) => window.GUG_FIREBASE.saveRecoveryRequest(rec);
            }
            if (!window.GUG_DB.saveEmployeeToCloud) {
                window.GUG_DB.saveEmployeeToCloud = (e) => window.GUG_FIREBASE.saveEmployee(e);
            }
            if (!window.GUG_DB.saveDealerToCloud) {
                window.GUG_DB.saveDealerToCloud = (d) => window.GUG_FIREBASE.saveDealer(d);
            }
            if (!window.GUG_DB.saveProductToCloud) {
                window.GUG_DB.saveProductToCloud = (p) => window.GUG_FIREBASE.saveProduct(p);
            }
            if (!window.GUG_DB.deleteProductFromCloud) {
                window.GUG_DB.deleteProductFromCloud = (id) => window.GUG_FIREBASE.deleteProduct(id);
            }
            if (!window.GUG_DB.getPcBuildRequests) {
                window.GUG_DB.getPcBuildRequests = () => JSON.parse(localStorage.getItem('admin_pc_build_requests') || '[]');
            }
            if (!window.GUG_DB.savePcBuildRequest) {
                window.GUG_DB.savePcBuildRequest = (b) => window.GUG_FIREBASE.savePcBuildRequest(b);
            }
            if (!window.GUG_DB.updatePcBuildStatus) {
                window.GUG_DB.updatePcBuildStatus = (id, s, n) => window.GUG_FIREBASE.updatePcBuildStatus(id, s, n);
            }
            if (!window.GUG_DB.deletePcBuild) {
                window.GUG_DB.deletePcBuild = (id) => window.GUG_FIREBASE.deletePcBuild(id);
            }
        }
    };

    // Auto-init on DOMContentLoaded or immediate
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.GUG_FIREBASE.init());
    } else {
        window.GUG_FIREBASE.init();
    }
})();
