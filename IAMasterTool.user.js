// ==UserScript==
// @name         IA Master Tool v15.1
// @namespace    http://tampermonkey.net/
// @version      15.1
// @description  Comprehensive automation suite for IssueAware
// @author       Jacob Copps
// @match        https://www.connexus.com/issueaware/issue.aspx*
// @updateURL    https://raw.githubusercontent.com/jwcopps/ARCASST-Scripts/refs/heads/main/IAMasterTool.user.js
// @downloadURL  https://raw.githubusercontent.com/jwcopps/ARCASST-Scripts/refs/heads/main/IAMasterTool.user.js
// @grant        GM_xmlhttpRequest
// ==/UserScript==

/*
   --- CHANGELOG v15.1 ---
   - UI: Removed Draggable functionality. Button is now fixed in the top-right corner.
   - UI: Slowed down the Idle Ripple animation to 5 seconds (was 3s).
   - Core: Retains Smart Waits, Auto-Retry, Crystal Success Animation, and Dual Nav.
*/

(function() {
    'use strict';

    // --- CONFIGURATION ---
    const KEY_ACTIVE = 'ia_master_active';
    const KEY_DATA   = 'ia_master_data';
    const KEY_CHOICE = 'ia_master_choice';
    const KEY_CONFIG = 'ia_master_config';

    const STATIC_TEAM = [
        { name: "Davis, Stephanie", id: "5461043", role: "stakeholder" },
        { name: "Peresta, Jessica", id: "5863631", role: "stakeholder" },
        { name: "Vest, Jessica", id: "5929046", role: "stakeholder" }
    ];

    const CARETAKER_KEYWORDS = ["Caretaker", "Guardian", "Learning Coach", "Parent"];
    const IGNORE_KEYWORDS = ["Attendance", "Testing"];

    const EXISTING_SUFFIXES = [
        "Lesson Escalation", "Lesson Esc",
        "Contact Escalation", "Contact Esc",
        "Lesson and Contact Escalation", "Less/Cont Esc"
    ];

    // --- INJECT CSS STYLES ---
    const style = document.createElement('style');
    style.innerHTML = `
        /* --- Main Button --- */
        .ia-btn-main {
            position: fixed;
            top: 60px; right: 20px; z-index: 99999;
            padding: 10px 20px; color: white; border: none; border-radius: 50px;
            cursor: pointer; font-weight: 600; font-family: 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #28a745, #218838);
            transition: transform 0.2s, background 0.3s;
            font-size: 14px; letter-spacing: 0.5px; user-select: none;

            /* Default Idle Ripple (Slower 5s) */
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            animation: ia-ripple-green 5s infinite;
        }

        /* Hover Effect: Scale Up */
        .ia-btn-main:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }

        /* Active/Click Effect: Scale Down */
        .ia-btn-main:active {
            transform: scale(0.95);
        }

        /* Working State: Fast Gold Ripple */
        .ia-btn-main.working {
            animation: ia-ripple-gold 1.5s infinite;
            cursor: wait;
        }

        /* --- Animations --- */
        @keyframes ia-ripple-green {
            0% { box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.7); }
            70% { box-shadow: 0 0 0 12px rgba(40, 167, 69, 0); }
            100% { box-shadow: 0 0 0 0 rgba(40, 167, 69, 0); }
        }

        @keyframes ia-ripple-gold {
            0% { box-shadow: 0 0 0 0 rgba(224, 168, 0, 0.7); }
            70% { box-shadow: 0 0 0 15px rgba(224, 168, 0, 0); }
            100% { box-shadow: 0 0 0 0 rgba(224, 168, 0, 0); }
        }

        /* --- Toast Notification --- */
        .ia-toast {
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px);
            background: rgba(33, 37, 41, 0.95); color: white;
            padding: 12px 24px; border-radius: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            font-family: 'Segoe UI', sans-serif; font-size: 14px; font-weight: 500;
            z-index: 100002; opacity: 0; transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            display: flex; align-items: center; gap: 10px;
        }
        .ia-toast.active { transform: translateX(-50%) translateY(0); opacity: 1; }
        .ia-toast-spinner {
            width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
            border-top: 2px solid white; border-radius: 50%;
            animation: ia-spin 1s linear infinite;
        }

        /* --- Loader --- */
        .ia-loading-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(5px);
            z-index: 100000; display: flex; flex-direction: column; justify-content: center; align-items: center;
            opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
        }
        .ia-loading-overlay.active { opacity: 1; pointer-events: all; }
        .ia-loader-card {
            background: white; padding: 40px; border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
            text-align: center; width: 300px; border: 1px solid rgba(0,0,0,0.05);
        }
        .ia-spinner {
            width: 50px; height: 50px; border: 5px solid #f3f3f3;
            border-top: 5px solid #3498db; border-radius: 50%;
            margin: 0 auto 20px auto; animation: ia-spin 1s linear infinite;
        }
        .ia-loading-text { font-size: 18px; color: #333; font-weight: 600; font-family: 'Segoe UI', sans-serif; }
        .ia-loading-sub { font-size: 14px; color: #888; margin-top: 8px; }

        @keyframes ia-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* --- Success Animation (Elastic) --- */
        .ia-success-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: transparent;
            z-index: 100001;
            display: flex; justify-content: center; align-items: center;
            opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
        }
        .ia-success-overlay.active { opacity: 1; pointer-events: all; }

        .ia-success-card {
            background: white; padding: 50px; border-radius: 30px;
            box-shadow: 0 30px 80px -10px rgba(0, 0, 0, 0.2);
            text-align: center;
            transform: scale(0.5); opacity: 0;
            transition: all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            border: 1px solid rgba(0,0,0,0.08);
        }
        .ia-success-overlay.active .ia-success-card { transform: scale(1); opacity: 1; }

        .checkmark-wrapper { width: 100px; height: 100px; position: relative; margin: 0 auto; }
        .checkmark__circle { stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 3; stroke-miterlimit: 10; stroke: #48bb78; fill: none; }
        .checkmark__check { transform-origin: 50% 50%; stroke-dasharray: 48; stroke-dashoffset: 48; stroke-width: 3; }

        .ia-success-overlay.active .checkmark__circle { animation: stroke 0.8s cubic-bezier(0.65, 0, 0.45, 1) 0.3s forwards; }
        .ia-success-overlay.active .checkmark__check { animation: stroke 0.4s cubic-bezier(0.65, 0, 0.45, 1) 0.9s forwards; }

        @keyframes stroke { 100% { stroke-dashoffset: 0; } }

        .ia-success-text { margin-top: 25px; font-size: 26px; font-weight: 800; color: #2d3748; opacity: 0; transform: translateY(15px); }
        .ia-success-overlay.active .ia-success-text { animation: fadeInUp 0.5s ease 1.1s forwards; }

        @keyframes fadeInUp { to { opacity: 1; transform: translateY(0); } }

        /* --- Modals & Inputs --- */
        .ia-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 99998;
            backdrop-filter: blur(3px); display: flex; justify-content: center; align-items: center;
        }
        .ia-modal {
            background: #fff; padding: 30px; border-radius: 16px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            width: 540px; max-height: 85vh; overflow-y: auto; overflow-x: hidden;
            font-family: 'Segoe UI', sans-serif;
            animation: ia-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            box-sizing: border-box;
        }
        @keyframes ia-slide-up { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .ia-modal h3 { margin: 0; color: #2d3748; font-size: 20px; }
        .ia-modal p { color: #718096; line-height: 1.5; font-size: 14px; margin-bottom: 20px; }
        .ia-input {
            width: 100%; padding: 12px 15px; margin-bottom: 20px;
            border: 2px solid #e2e8f0; border-radius: 8px;
            font-size: 15px; transition: border-color 0.2s; box-sizing: border-box;
        }
        .ia-input:focus { border-color: #3182ce; outline: none; }

        .ia-btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.2s; }
        .ia-btn-primary { background: #3182ce; color: white; box-shadow: 0 2px 4px rgba(49, 130, 206, 0.2); }
        .ia-btn-primary:hover { background: #2c5282; transform: translateY(-1px); }
        .ia-btn-secondary { background: #edf2f7; color: #4a5568; }
        .ia-btn-secondary:hover { background: #e2e8f0; }
        .ia-btn-blue { background: #4299e1; color: white; margin: 0 5px; flex: 1; padding: 10px 20px; font-size: 14px; }
        .ia-btn-blue:hover { background: #3182ce; }
        .ia-btn-small { padding: 6px 12px; font-size: 12px; margin-bottom: 12px; }

        /* --- Log Cards --- */
        .ia-log-card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 10px; padding: 12px; transition: box-shadow 0.2s; }
        .ia-log-card:hover { box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-color: #cbd5e0; }
        .ia-log-header { display: flex; align-items: flex-start; cursor: pointer; }
        .ia-log-content { flex: 1; margin-left: 10px; }
        .ia-log-meta { font-size: 13px; color: #2d3748; margin-bottom: 4px; }
        .ia-log-preview { font-size: 12px; color: #718096; line-height: 1.4; }
        .ia-log-body { font-size: 13px; color: #4a5568; margin-top: 10px; padding-top: 10px; border-top: 1px solid #edf2f7; display: none; line-height: 1.5; }
    `;
    document.head.appendChild(style);


    // --- HELPER FUNCTIONS ---
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const waitFor = (conditionCallback, timeoutMs = 5000, intervalMs = 100) => {
        return new Promise(resolve => {
            const startTime = Date.now();
            const check = () => {
                if (conditionCallback()) resolve(true);
                else if (Date.now() - startTime > timeoutMs) resolve(false);
                else setTimeout(check, intervalMs);
            };
            check();
        });
    };
    const isActive = () => sessionStorage.getItem(KEY_ACTIVE) === 'true';

    // -- VISUALS --
    let loadingOverlay, loadingText, loadingSub, successOverlay, toastElement;

    function initVisuals() {
        if (!document.getElementById('ia-loader')) {
            loadingOverlay = document.createElement('div'); loadingOverlay.id = 'ia-loader'; loadingOverlay.className = 'ia-loading-overlay';
            loadingOverlay.innerHTML = `<div class="ia-loader-card"><div class="ia-spinner"></div><div class="ia-loading-text">Processing...</div><div class="ia-loading-sub">Please do not click anything</div></div>`;
            document.body.appendChild(loadingOverlay);
            loadingText = loadingOverlay.querySelector('.ia-loading-text'); loadingSub = loadingOverlay.querySelector('.ia-loading-sub');
        }
        if (!document.getElementById('ia-success')) {
            successOverlay = document.createElement('div'); successOverlay.id = 'ia-success'; successOverlay.className = 'ia-success-overlay';
            successOverlay.innerHTML = `
                <div class="ia-success-card">
                    <div class="checkmark-wrapper">
                        <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                            <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
                            <path class="checkmark__check" fill="none" stroke="#48bb78" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                        </svg>
                    </div>
                    <div class="ia-success-text">All Done!</div>
                </div>`;
            document.body.appendChild(successOverlay);
        }
        if (!document.getElementById('ia-toast')) {
            toastElement = document.createElement('div'); toastElement.id = 'ia-toast'; toastElement.className = 'ia-toast';
            toastElement.innerHTML = `<div class="ia-toast-spinner"></div><span id="ia-toast-text">Working...</span>`;
            document.body.appendChild(toastElement);
        }
    }

    function toggleLoader(show, text = "Processing...", sub = "Please do not click anything") {
        initVisuals();
        if (show) { loadingText.innerText = text; loadingSub.innerText = sub; loadingOverlay.classList.add('active'); }
        else { loadingOverlay.classList.remove('active'); }
    }

    function showToast(text) { initVisuals(); document.getElementById('ia-toast-text').innerText = text; toastElement.classList.add('active'); }
    function hideToast() { if(toastElement) toastElement.classList.remove('active'); }

    function showSuccessAnimation() {
        initVisuals();
        setTimeout(() => {
            successOverlay.classList.add('active');
            setTimeout(() => { successOverlay.classList.remove('active'); }, 3000);
        }, 500);
    }

    const updateBtn = (text, color) => {
        if (typeof btn !== 'undefined' && btn) {
            btn.innerHTML = text;
            if(color) btn.style.background = color;
            if (text.includes('Working') || text.includes('Exec') || text.includes('Adding')) btn.classList.add('working');
            else btn.classList.remove('working');
        }
    };

    const stopScript = () => {
        sessionStorage.removeItem(KEY_ACTIVE);
        sessionStorage.removeItem(KEY_DATA);
        sessionStorage.removeItem(KEY_CHOICE);
        sessionStorage.removeItem(KEY_CONFIG);

        toggleLoader(false);
        hideToast();
        showSuccessAnimation();

        updateBtn('✅ Done!', '#48bb78');
        setTimeout(() => { updateBtn('📝 IA Master Tool', 'linear-gradient(135deg, #28a745, #218838)'); }, 3500);
    };

    function setInput(idOrName, value) {
        let element = document.getElementById(idOrName);
        if (!element) element = document.getElementsByName(idOrName)[0];
        if (element) {
            if (element.value === value) return false;
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
            return true;
        }
        return false;
    }

    // --- NETWORK REQUEST ---
    function fetchURL(url) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                onload: function(response) {
                    if (response.status === 200) {
                        const parser = new DOMParser();
                        resolve(parser.parseFromString(response.responseText, "text/html"));
                    } else { console.error("Failed to load: " + url); resolve(null); }
                },
                onerror: function(err) { console.error("Error loading: " + url, err); resolve(null); }
            });
        });
    }

    // --- SCRAPING LOGIC ---
    function formatNameForSystem(fullName) {
        if (!fullName) return "";
        const parts = fullName.trim().split(' ');
        if (parts.length < 2) return fullName;
        const first = parts.shift();
        const last = parts.join(' ');
        return `${last}, ${first}`;
    }

    async function scrapeData(studentId) {
        toggleLoader(true, "Gathering Data...", "Fetching Grades, Logs, and Profile info");
        const profileUrl = `https://www.connexus.com/dataview/789?idWebuser=${studentId}`;
        const gradesUrl = `https://www.connexus.com/gradeBook/default.aspx?idWebuser=${studentId}&idSchoolYear=27`;
        const overviewUrl = `https://www.connexus.com/webuser/overview.aspx?idWebuser=${studentId}`;
        const logsUrl = `https://www.connexus.com/log/default.aspx?idWebuser=${studentId}`;

        let profileDoc, gradesDoc, overviewDoc, logDoc;
        let attempts = 0; let success = false;

        while(attempts < 3 && !success) {
            try {
                if (attempts > 0) toggleLoader(true, `Retrying (${attempts}/3)...`, "Connection hiccup. One moment.");
                [profileDoc, gradesDoc, overviewDoc, logDoc] = await Promise.all([ fetchURL(profileUrl), fetchURL(gradesUrl), fetchURL(overviewUrl), fetchURL(logsUrl) ]);
                if (profileDoc && gradesDoc && overviewDoc && logDoc) success = true;
                else throw new Error("Missing document");
            } catch (e) { attempts++; await wait(1000); }
        }

        if (!success) { alert("Failed to gather data after 3 attempts."); return null; }

        // 1. PROFILE
        const h1 = profileDoc.querySelector('h1');
        let formattedName = "Unknown";
        if (h1) {
            const parts = h1.innerText.split(' - ');
            if (parts.length > 1) {
                const nameParts = parts[1].trim().split(' ');
                if (nameParts.length > 0) {
                    const firstInitial = nameParts[0][0];
                    const lastName = nameParts[nameParts.length - 1];
                    formattedName = `${firstInitial}, ${lastName}`;
                }
            }
        }
        const getVal = (doc, id) => { const el = doc.getElementById(id); return el ? el.innerText.trim() : "N/A"; };
        const profileData = {
            formattedName: formattedName,
            grade: getVal(profileDoc, 'EF_Final_Grade'),
            enrollDate: getVal(profileDoc, 'EF_EnrollmentDate'),
            lastLesson: getVal(profileDoc, 'EF_LastLessonComplete'),
            lastContact: getVal(profileDoc, 'EF_StudentLastSynchronousContact'),
            iepText: getVal(profileDoc, 'IEP'),
            plan504Text: getVal(profileDoc, 'Plan504'),
            isIep504: (getVal(profileDoc, 'IEP') !== "N/A" && getVal(profileDoc, 'IEP') !== "") || (getVal(profileDoc, 'Plan504') !== "N/A" && getVal(profileDoc, 'Plan504') !== "") ? "Yes" : "No"
        };

        // 2. GRADEBOOK
        let completionPct = "Unknown";
        let gradesTableHTML = "";
        const allThs = Array.from(gradesDoc.querySelectorAll('th'));
        const sectionHeader = allThs.find(th => th.innerText.trim() === 'Section');
        if (sectionHeader) {
            const originalTable = sectionHeader.closest('table');
            if (originalTable) {
                const newTable = originalTable.cloneNode(true);
                let totalCompleted = 0; let totalAssigned = 0;
                const rows = newTable.querySelectorAll('tr');
                for (let i = rows.length - 1; i >= 0; i--) {
                    const row = rows[i];
                    if (row.querySelector('th')) continue;
                    if (row.classList.contains('dataGridFooter') || row.classList.contains('dataGridPager')) {
                        if (row.classList.contains('dataGridPager')) row.remove();
                        continue;
                    }
                    const cells = row.querySelectorAll('td');
                    if (cells.length > 5) {
                        const stageInput = cells[cells.length - 1].querySelector('input[type="image"]');
                        let keepRow = false;
                        if (stageInput) {
                            const src = stageInput.src;
                            if (src.includes('inprogress') || src.includes('pending') || src.includes('complete')) keepRow = true;
                        }
                        if (!keepRow) row.remove();
                        else {
                            const compText = cells[4].innerText.trim();
                            const parts = compText.split('/');
                            if (parts.length > 1) {
                                const num = parseInt(parts[0].trim(), 10);
                                const den = parseInt(parts[1].split('(')[0].trim(), 10);
                                if (!isNaN(num) && !isNaN(den)) { totalCompleted += num; totalAssigned += den; }
                            }
                        }
                    }
                }
                if (totalAssigned > 0) completionPct = `${totalCompleted}/${totalAssigned} (${Math.round((totalCompleted / totalAssigned) * 100)}%)`;
                else completionPct = "0/0 (0%)";

                const footerRow = newTable.querySelector('tr.dataGridFooter');
                if (footerRow) {
                    const footerCells = footerRow.querySelectorAll('td');
                    if (footerCells.length > 4) {
                        footerCells[4].innerText = completionPct;
                        footerCells[4].style.fontWeight = 'bold';
                    }
                }
                newTable.style.width = '100%'; newTable.style.borderCollapse = 'collapse'; newTable.style.fontSize = '8pt'; newTable.style.fontFamily = 'Verdana, Arial, sans-serif'; newTable.style.border = '1px solid #e0e0e0';
                const headers = newTable.querySelectorAll('th');
                headers.forEach(th => { th.style.backgroundColor = '#f2f2f2'; th.style.color = '#333'; th.style.fontWeight = 'bold'; th.style.fontSize = '8pt'; th.style.padding = '6px'; th.style.border = '1px solid #ccc'; th.style.textAlign = 'left'; });
                const cells = newTable.querySelectorAll('td');
                cells.forEach(td => { td.style.fontSize = '8pt'; td.style.padding = '5px'; td.style.border = '1px solid #e0e0e0'; td.style.color = '#333'; if (td.align === 'center') td.style.textAlign = 'center'; });
                gradesTableHTML = newTable.outerHTML;
            }
        }

        // 3. PEOPLE
        let sscName = null;
        let caretakers = [];
        const studentObj = { name: formattedName, id: studentId, role: 'subject' };

        const householdRows = overviewDoc.querySelectorAll('tr.portalletEnhancedpurpleCell');
        householdRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 6) {
                const nameCell = cells[0];
                const rolesCell = cells[5];
                const roleText = rolesCell.innerText.trim();
                const personName = nameCell.innerText.trim();
                const link = nameCell.querySelector('a[href*="idWebuser="]');
                let id = null;
                if (link) { const match = link.href.match(/idWebuser=(\d+)/i); if (match) id = match[1]; }
                if (id && CARETAKER_KEYWORDS.some(k => roleText.includes(k))) {
                    caretakers.push({ name: personName, id: id, role: 'subject' });
                }
            }
        });

        // 4. TEACHERS
        let teacherMap = new Map();
        const sectionPanel = overviewDoc.getElementById('sections_ctl00_sectionsPanel');
        if (sectionPanel) {
            const sectionRows = sectionPanel.querySelectorAll('table.datagridCondensed tr');
            sectionRows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length > 1) {
                    const course = cells[0].innerText.trim();
                    const teacherCell = cells[1];
                    if (course.includes("Student Success Coach")) sscName = teacherCell.innerText.trim();

                    let currentNameBuffer = "";
                    teacherCell.childNodes.forEach(node => {
                        if (node.nodeType === 3) currentNameBuffer += node.textContent;
                        else if (node.nodeType === 1 && node.tagName === 'A' && node.href.includes('dataviewList.aspx')) {
                            const idMatch = node.href.match(/idWebUser=(\d+)/i);
                            if (idMatch) {
                                const id = idMatch[1];
                                const cleanName = currentNameBuffer.replace(/^[\s,]+|[\s,]+$/g, '').trim();
                                if (cleanName) {
                                    if (!teacherMap.has(id)) teacherMap.set(id, { name: cleanName, courses: [], id: id });
                                    teacherMap.get(id).courses.push(course);
                                }
                                currentNameBuffer = "";
                            }
                        }
                    });
                }
            });
        }
        const formattedSSC = formatNameForSystem(sscName);
        let teachers = Array.from(teacherMap.values());
        teachers = teachers.filter(t => t.courses.some(c => !IGNORE_KEYWORDS.some(k => c.includes(k))));
        teachers = teachers.filter(t => t.id !== studentId && !caretakers.some(c => c.id === t.id));
        if (sscName) teachers = teachers.filter(t => t.name !== sscName);

        // 5. LOGS
        const myLogsRaw = [];
        const otherLogsRaw = [];
        if (formattedSSC) {
            const lookback = new Date(); lookback.setDate(lookback.getDate() - 30);
            const logRows = logDoc.querySelectorAll('tr.logHeaderRow');
            logRows.forEach(header => {
                const details = header.nextElementSibling;
                if (!details || !details.classList.contains('logDetailsRow')) return;
                const dateTh = header.querySelectorAll('th')[1];
                const dateStr = dateTh ? dateTh.querySelector('span').innerText.trim() : "";
                const entryDate = new Date(dateStr);
                if (isNaN(entryDate) || entryDate < lookback) return;
                const detailsCol = details.querySelector('.logDetailsColumn');
                const detailsText = detailsCol ? detailsCol.innerText : "";
                const recorderMatch = detailsText.match(/Recorder:\s*(.*?)(\n|$)/);
                const actualRecorder = recorderMatch ? recorderMatch[1].trim() : "Unknown";
                const typeMatch = detailsText.match(/Contact Type:\s*(.*?)(\n|$)/);
                const contactType = typeMatch ? typeMatch[1].trim() : "Log";
                const comment = details.querySelector('.logCommentsColumn span') ? details.querySelector('.logCommentsColumn span').innerText.trim() : "";
                const logObj = { dateStr, dateObj: entryDate, recorder: actualRecorder, contactType, comment, id: Math.random().toString(36).substr(2,9) };

                if (actualRecorder.includes(formattedSSC)) myLogsRaw.push(logObj);
                else otherLogsRaw.push(logObj);
            });
        }
        toggleLoader(false);
        return { profileData, completionPct, gradesTableHTML, studentObj, caretakers, teachers, myLogsRaw, otherLogsRaw, formattedSSC };
    }

    // --- EXECUTION LOGIC ---
    function setAssigneeByName(nameToMatch) {
        if (!nameToMatch) return;
        const dropdown = document.getElementById('assignee');
        if (dropdown) {
            for (let i = 0; i < dropdown.options.length; i++) {
                if (dropdown.options[i].text.includes(nameToMatch)) {
                    dropdown.selectedIndex = i;
                    dropdown.dispatchEvent(new Event('change', { bubbles: true }));
                    return;
                }
            }
        }
    }

    async function ensureEditorOpen() {
        if (document.getElementById('description_editor_contentIframe')) return true;
        const editBtn = document.getElementById('editDescription');
        if (editBtn) {
            editBtn.click();
            const found = await waitFor(() => document.getElementById('description_editor_contentIframe'), 10000);
            return found;
        }
        return false;
    }

    async function updateDescription(newContent, isUpdateMode) {
        await ensureEditorOpen();
        const iframe = document.getElementById('description_editor_contentIframe');
        if (iframe) {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            if (doc && doc.body) {
                if (isUpdateMode) {
                    doc.body.innerHTML = newContent + "<br><br>________________________________________<br>" + doc.body.innerHTML;
                } else {
                    if (!doc.body.innerHTML.includes("Enrollment Date:")) doc.body.innerHTML = newContent;
                }
                iframe.focus();
            }
        }
    }

    async function processUserList(finalQueue) {
        if (finalQueue.length === 0) return;
        updateBtn(`👥 Adding ${finalQueue.length} Users...`, '#e0a800');
        showToast(`Adding ${finalQueue.length} Stakeholders...`);
        const addBtn = document.getElementById('addUser');
        if (addBtn) addBtn.click();
        const treeContainer = await waitFor(() => document.getElementById('userSelectorOverlay_idLocationTree_locationTreePortal_locationTree') || document.querySelector('span.rtIn'));
        if (treeContainer) {
             const allSpans = Array.from(document.querySelectorAll('span.rtIn'));
             const arcaSpan = allSpans.find(s => s.innerText.trim() === 'ARCA');
             if (arcaSpan) arcaSpan.click();
        }
        const searchReady = await waitFor(() => document.getElementById('searchTerms') && document.getElementById('searchButton'));
        if (!searchReady) return;
        const searchBox = document.getElementById('searchTerms');
        const searchBtn = document.getElementById('searchButton');
        for (const user of finalQueue) {
            searchBox.value = user.id;
            searchBtn.click();
            const chkId = `add${user.id}AsA${user.role}`;
            const userFound = await waitFor(() => document.getElementById(chkId));
            if (userFound) {
                const chk = document.getElementById(chkId);
                if (!chk.checked) chk.click();
            }
        }
        await waitFor(() => {
            const spans = document.querySelectorAll('span.btnContent');
            for (const span of spans) { if (span.innerText.trim() === "Add Users") return true; }
            return false;
        });
        const allBtnSpans = document.querySelectorAll('span.btnContent');
        for (const span of allBtnSpans) { if (span.innerText.trim() === "Add Users") { span.click(); break; } }
        const rostaBtn = await waitFor(() => document.querySelector('button[title="Remove Brian Rosta from the list of stakeholders."]'), 2000);
        if (rostaBtn) document.querySelector('button[title="Remove Brian Rosta from the list of stakeholders."]').click();
        hideToast();
    }

    // --- MAIN ENGINE ---
    async function runEngine() {
        initVisuals();
        const config = JSON.parse(sessionStorage.getItem(KEY_CONFIG));
        if (config.mode === 'new' || (config.mode === 'update' && config.updateOpts.header)) {
            if (setInput('idIssueSystem', '23')) return;
        }

        let data = JSON.parse(sessionStorage.getItem(KEY_DATA));
        if (!data) {
            data = await scrapeData(config.id);
            if (!data) { stopScript(); return; }
            sessionStorage.setItem(KEY_DATA, JSON.stringify(data));
        }

        let choices = JSON.parse(sessionStorage.getItem(KEY_CHOICE));
        if (!choices) {
            toggleLoader(false);
            const askStakeholders = (config.mode === 'new') || (config.mode === 'update' && config.updateOpts.stakeholders);
            const askLogs = (config.mode === 'new') || (config.mode === 'update' && config.updateOpts.grades);
            const continueToLogs = (manualStakeholders) => {
                const myLogs = data.myLogsRaw || [];
                if (askLogs && data.otherLogsRaw.length > 0) {
                    showLogModal(data.otherLogsRaw, (selectedOtherLogs) => {
                        let allFinalLogs = [];
                        if (selectedOtherLogs !== null) {
                            allFinalLogs = [...myLogs, ...selectedOtherLogs];
                            allFinalLogs.sort((a, b) => new Date(b.dateStr) - new Date(a.dateStr));
                        }
                        sessionStorage.setItem(KEY_CHOICE, JSON.stringify({ stakeholders: manualStakeholders, logs: allFinalLogs }));
                        location.reload();
                    });
                } else {
                    const allFinalLogs = myLogs;
                    allFinalLogs.sort((a, b) => new Date(b.dateStr) - new Date(a.dateStr));
                    sessionStorage.setItem(KEY_CHOICE, JSON.stringify({ stakeholders: manualStakeholders, logs: allFinalLogs }));
                    location.reload();
                }
            };
            if (askStakeholders) {
                showTeacherModal(data.teachers, (manualStakeholders) => { continueToLogs(manualStakeholders); });
            } else {
                continueToLogs(null);
            }
            return;
        }

        updateBtn('⚙️ Executing...', '#e0a800');
        let finalQueue = [];
        if (choices.stakeholders !== null) {
            finalQueue = [data.studentObj, ...data.caretakers, ...choices.stakeholders, ...STATIC_TEAM];
        }

        let suffix = "Lesson Escalation";
        let alarm = "ST approaching lesson alarm for not completing lessons in 10+ days.";
        if (config.type === 'contact') { suffix = "Contact Escalation"; alarm = "ST approaching contact alarm for no contact in 27+ days."; }
        else if (config.type === 'both') { suffix = "Lesson and Contact Escalation"; alarm = "ST approaching lesson alarm for not completing lessons in 10+ days.<br>ST approaching contact alarm for no contact in 27+ days."; }

        let logHtml = "";
        if (choices.logs.length > 0) {
            const lis = choices.logs.map(l => `<li>${l.dateStr} - ${l.contactType} - Recorder: ${l.recorder} - ${l.comment}</li>`).join('');
            logHtml = `<b>Recent Logs:</b><br><ul style="margin: 5px 0 5px 20px;">${lis}</ul><br>`;
        }

        const fullText = `
            Enrollment Date: ${data.profileData.enrollDate}<br>
            Last Lesson: ${data.profileData.lastLesson}<br>
            Last Synchronous Contact: ${data.profileData.lastContact}<br>
            IEP/504 Student: ${data.profileData.isIep504}<br>
            Lesson Completion Percentage: ${data.completionPct}<br>
            Grades: See attached screenshot<br><br>
            Detailed description to explain the question, issue, or problem you are trying to solve:<br>
            ${alarm}<br>
            <br>
            ${logHtml}
            <br>
            <b>Current Grades:</b><br>
            ${data.gradesTableHTML}
        `;

        setAssigneeByName(data.formattedSSC);
        await wait(200);
        setInput('idIssueComponent', '2213');
        setInput('idIssueStatus', '368');
        setInput('idIssueType', '2847');
        setInput('idIssueUrgency', '2');
        const pBox = document.getElementById('isPrivate');
        if(pBox && pBox.checked) { pBox.removeAttribute('onclick'); pBox.click(); }
        const d = new Date(); let a=0; while(a<5){ d.setDate(d.getDate()+1); if(d.getDay()!=0&&d.getDay()!=6) a++; }
        const dateStr = d.toLocaleDateString('en-US', {year: 'numeric', month: '2-digit', day: '2-digit'});

        if (config.mode === 'new') {
            const nm = `ARCA - ${config.id} - ${data.profileData.formattedName} - Grade: ${data.profileData.grade} - ${suffix}`;
            const nb = document.getElementById('name');
            if(nb && nb.value !== nm) { nb.value = nm; nb.dispatchEvent(new Event('change', { bubbles: true })); }
            if (config.type !== 'contact') {
                setInput('target_dPk_dIn', dateStr);
                setInput('targetTime_dIn', '2:00 PM');
                setTimeout(() => setInput('targetReminderEmailDays', '0'), 500);
            }
            const spans = document.querySelectorAll('span.rtIn');
            for (let s of spans) { if (s.innerText.trim() === 'ARCA' && !s.classList.contains('rtSelected')) s.click(); }
        } else {
            if (config.updateOpts.name) {
                const nb = document.getElementById('name');
                if(nb) {
                    let cur = nb.value;
                    let targetSuffix = "";
                    if(config.type==='lesson') targetSuffix = " - Lesson Escalation";
                    else if(config.type==='contact') targetSuffix = " - Contact Escalation";
                    else targetSuffix = " - Lesson and Contact Escalation";
                    let foundOldSuffix = EXISTING_SUFFIXES.find(s => cur.includes(" - " + s));
                    if (foundOldSuffix) {
                        cur = cur.replace(" - " + foundOldSuffix, "");
                        nb.value = cur + targetSuffix;
                        nb.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        if((cur.length + targetSuffix.length) > 100) {
                           if(config.type==='lesson') targetSuffix = " - Lesson Esc";
                           else if(config.type==='contact') targetSuffix = " - Contact Esc";
                           else targetSuffix = " - Less/Cont Esc";
                        }
                        if((cur.length + targetSuffix.length) <= 100) {
                            nb.value = cur + targetSuffix;
                            nb.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                }
            }
            if (config.updateOpts.header && config.type !== 'contact') {
                setInput('target_dPk_dIn', dateStr);
                setInput('targetTime_dIn', '2:00 PM');
                setTimeout(() => setInput('targetReminderEmailDays', '0'), 500);
            }
        }

        if (finalQueue.length > 0) {
            await processUserList(finalQueue);
        }

        if (config.mode === 'new' || (config.mode === 'update' && config.updateOpts.grades)) {
            updateBtn('📝 Updating Text...', '#e0a800');
            showToast('Updating Description...');
            await updateDescription(fullText, config.mode === 'update');
        }

        stopScript();
    }

    function createModalBase(title, subtitle) {
        const overlay = document.createElement('div'); overlay.className = 'ia-overlay';
        const modal = document.createElement('div'); modal.className = 'ia-modal';
        const h3 = document.createElement('h3'); h3.innerText = title;
        modal.appendChild(h3);
        if (subtitle) { const p = document.createElement('p'); p.innerHTML = subtitle; modal.appendChild(p); }
        const close = () => { document.body.removeChild(overlay); };

        // ESC Key Handler
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                close();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        overlay.onclick = (e) => { if(e.target === overlay) close(); };
        overlay.appendChild(modal); document.body.appendChild(overlay);
        return { overlay, modal, close };
    }

    function createNavButtons(onNext, onSkip) {
        const div = document.createElement('div'); div.style.display = 'flex'; div.style.gap = '10px';
        const btnSkip = document.createElement('button'); btnSkip.innerText = 'Skip'; btnSkip.className = 'ia-btn ia-btn-secondary ia-btn-small'; btnSkip.onclick = onSkip;
        const btnNext = document.createElement('button'); btnNext.innerText = 'Next'; btnNext.className = 'ia-btn ia-btn-primary ia-btn-small'; btnNext.onclick = onNext;
        div.appendChild(btnSkip); div.appendChild(btnNext);
        return div;
    }

    function showLogModal(otherLogs, onConfirm) {
        const { overlay, modal, close } = createModalBase('Select Additional Logs', '<b>Note:</b> Your logs (SSC) from the last 30 days are included automatically.<br>Select any <i>other</i> logs from the past 30 days to include:');
        modal.style.width = '600px';
        const h3 = modal.querySelector('h3');
        const headerWrapper = document.createElement('div');
        headerWrapper.style.display='flex'; headerWrapper.style.justifyContent='space-between'; headerWrapper.style.alignItems='center'; headerWrapper.style.marginBottom='10px';
        modal.insertBefore(headerWrapper, h3);
        headerWrapper.appendChild(h3);

        const handleNext = () => { const sel = []; otherLogs.forEach(l => { if(document.getElementById('log_'+l.id)?.checked) sel.push(l); }); close(); onConfirm(sel); };
        const handleSkip = () => { close(); onConfirm(null); };

        headerWrapper.appendChild(createNavButtons(handleNext, handleSkip));

        const form = document.createElement('div'); form.style.marginTop = '15px';
        if (otherLogs.length === 0) { form.innerHTML = "<p><i>No other logs found.</i></p>"; }
        else {
            const btnAll = document.createElement('button'); btnAll.innerText = 'Select All'; btnAll.className = 'ia-btn ia-btn-secondary ia-btn-small';
            let allSelected = false;
            btnAll.onclick = () => {
                allSelected = !allSelected;
                const checkboxes = form.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(chk => chk.checked = allSelected);
                btnAll.innerText = allSelected ? 'Deselect All' : 'Select All';
            };
            form.appendChild(btnAll);
            otherLogs.forEach(log => {
                const card = document.createElement('div'); card.className = 'ia-log-card';
                const header = document.createElement('div'); header.className = 'ia-log-header';
                const chk = document.createElement('input'); chk.type='checkbox'; chk.id='log_'+log.id; chk.value=log.id; chk.style.marginRight='10px';
                const cleanComment = log.comment.replace(/\s+/g, ' ').trim();
                const previewText = cleanComment.length > 100 ? cleanComment.substring(0, 100) + "..." : cleanComment;
                const contentContainer = document.createElement('div'); contentContainer.className = 'ia-log-content';
                const meta = document.createElement('div'); meta.className = 'ia-log-meta';
                meta.innerHTML = `<b>${log.dateStr}</b> <span style="color:#666">- ${log.contactType}</span> <span style="color:#3182ce; font-weight:600;">- ${log.recorder}</span>`;
                const prev = document.createElement('div'); prev.className = 'ia-log-preview'; prev.innerText = previewText;
                contentContainer.appendChild(meta); contentContainer.appendChild(prev);
                header.appendChild(chk); header.appendChild(contentContainer); card.appendChild(header);
                const body = document.createElement('div'); body.className='ia-log-body'; body.innerText = log.comment;
                const toggle = document.createElement('span'); toggle.innerText = '▼'; toggle.style.fontSize='10px'; toggle.style.color='#999'; toggle.style.marginLeft='5px';
                header.appendChild(toggle);
                header.onclick = (e) => { if (e.target !== chk) { body.style.display = body.style.display === 'block' ? 'none' : 'block'; toggle.innerText = body.style.display === 'block' ? '▲' : '▼'; } };
                card.appendChild(body); form.appendChild(card);
            });
        }
        modal.appendChild(form);
        const botNav = document.createElement('div'); botNav.style.marginTop='20px'; botNav.style.display='flex'; botNav.style.justifyContent='flex-end';
        const btnSkipBot = document.createElement('button'); btnSkipBot.innerText='Skip'; btnSkipBot.className='ia-btn ia-btn-secondary'; btnSkipBot.style.marginRight='10px'; btnSkipBot.onclick = handleSkip;
        const btnNextBot = document.createElement('button'); btnNextBot.innerText='Next'; btnNextBot.className='ia-btn ia-btn-primary'; btnNextBot.onclick = handleNext;
        botNav.appendChild(btnSkipBot); botNav.appendChild(btnNextBot); modal.appendChild(botNav);
    }

    function showTeacherModal(teachers, onConfirm) {
        const { overlay, modal, close } = createModalBase('Select Teachers', 'Student/Caretakers added automatically.');
        const h3 = modal.querySelector('h3');
        const headerWrapper = document.createElement('div');
        headerWrapper.style.display='flex'; headerWrapper.style.justifyContent='space-between'; headerWrapper.style.alignItems='center'; headerWrapper.style.marginBottom='10px';
        modal.insertBefore(headerWrapper, h3);
        headerWrapper.appendChild(h3);

        const handleNext = () => { const sel = []; teachers.forEach(t => { if(document.getElementById('chk_'+t.id).checked) sel.push({name:t.name, id:t.id, role:'stakeholder'}); }); close(); onConfirm(sel); };
        const handleSkip = () => { close(); onConfirm(null); };

        headerWrapper.appendChild(createNavButtons(handleNext, handleSkip));

        const form = document.createElement('div'); form.style.marginTop = '15px';
        if (teachers.length === 0) form.innerHTML = "<em>No teachers found.</em>";
        if (teachers.length > 0) {
            const btnAll = document.createElement('button'); btnAll.innerText = 'Select All'; btnAll.className = 'ia-btn ia-btn-secondary ia-btn-small';
            let allSelected = false;
            btnAll.onclick = () => { allSelected = !allSelected; const checkboxes = form.querySelectorAll('input[type="checkbox"]'); checkboxes.forEach(chk => chk.checked = allSelected); btnAll.innerText = allSelected ? 'Deselect All' : 'Select All'; };
            form.appendChild(btnAll);
        }
        teachers.forEach(t => {
            const d = document.createElement('div'); d.style.marginBottom='10px'; d.style.display='flex'; d.style.alignItems='center';
            const c = document.createElement('input'); c.type='checkbox'; c.id='chk_'+t.id; c.value=t.id; c.style.marginRight='10px';
            const l = document.createElement('label'); l.htmlFor='chk_'+t.id; l.style.cursor='pointer';
            const valid = t.courses.filter(cx => !IGNORE_KEYWORDS.some(k => cx.includes(k)));
            l.innerHTML = `<b>${t.name}</b> <span style='font-size:12px; color:#666;'>(${valid.length > 0 ? valid.join(', ') : t.courses.join(', ')})</span>`;
            d.appendChild(c); d.appendChild(l); form.appendChild(d);
        });
        modal.appendChild(form);

        const botNav = document.createElement('div'); botNav.style.marginTop='20px'; botNav.style.display='flex'; botNav.style.justifyContent='flex-end';
        const btnSkipBot = document.createElement('button'); btnSkipBot.innerText='Skip'; btnSkipBot.className='ia-btn ia-btn-secondary'; btnSkipBot.style.marginRight='10px'; btnSkipBot.onclick = handleSkip;
        const btnNextBot = document.createElement('button'); btnNextBot.innerText='Next'; btnNextBot.className='ia-btn ia-btn-primary'; btnNextBot.onclick = handleNext;
        botNav.appendChild(btnSkipBot); botNav.appendChild(btnNextBot); modal.appendChild(botNav);
    }

    function showMasterModal(onConfirm) {
        const { overlay, modal, close } = createModalBase('IA Master Tool', '');
        const input = document.createElement('input'); input.className = 'ia-input'; input.type='text'; input.placeholder='Enter Student ID'; input.style.marginTop = '15px';
        const nameField = document.getElementById('name');
        let isUpdateMode = false; let alreadyHasSuffix = false;
        if (nameField && nameField.value) {
            const m = nameField.value.match(/(\d{6,})/);
            if (m) { input.value = m[0]; isUpdateMode = true; }
            alreadyHasSuffix = EXISTING_SUFFIXES.some(s => nameField.value.includes(s));
        }
        modal.appendChild(input);

        // ENTER Key Logic
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (isUpdateMode) {
                    const updateBtn = modal.querySelector('button.ia-btn-primary');
                    if (updateBtn) updateBtn.click();
                } else {
                    const lessonBtn = modal.querySelector('button.ia-btn-blue');
                    if (lessonBtn) lessonBtn.click();
                }
            }
        });
        setTimeout(() => input.focus(), 50);

        if (isUpdateMode) {
            const h4 = document.createElement('div'); h4.innerHTML='<b>Update Existing IA</b>'; h4.style.borderBottom='1px solid #eee'; h4.style.marginBottom='10px'; h4.style.fontSize='16px'; h4.style.color='#2d3748'; modal.appendChild(h4);
            const typeC = document.createElement('div'); typeC.style.marginBottom='20px'; typeC.innerHTML='<b>Escalation Type:</b><br>';
            let selType = 'lesson';
            const addRad = (l,v) => { const r=document.createElement('input'); r.type='radio'; r.name='t'; r.value=v; r.id='t'+v; if(v=='lesson')r.checked=true; r.style.marginRight='5px'; r.onclick=()=>selType=v; const lb=document.createElement('label'); lb.htmlFor='t'+v; lb.innerText=l; lb.style.marginRight='15px'; typeC.appendChild(r); typeC.appendChild(lb); };
            addRad('Lesson','lesson'); addRad('Contact','contact'); addRad('Both','both'); modal.appendChild(typeC);
            const addChk = (id,l,chk) => { const d=document.createElement('div'); d.style.marginBottom='8px'; const c=document.createElement('input'); c.type='checkbox'; c.id=id; c.checked=chk; c.style.marginRight='10px'; const lb=document.createElement('label'); lb.htmlFor=id; lb.innerText=l; d.appendChild(c); d.appendChild(lb); modal.appendChild(d); return c; };
            const cHead = addChk('cHead','Update Status & Date', true);
            let cName = null;
            if (!alreadyHasSuffix) { cName = addChk('cName','Add Escalation Type to Title', true); }
            const cGrade = addChk('cGrade','Insert Gradebook, Stats & Logs', true);
            const cStake = addChk('cStake','Add Stakeholders', true);

            const btn = document.createElement('button'); btn.innerText='Run Update'; btn.className='ia-btn ia-btn-primary'; btn.style.width='100%'; btn.style.marginTop='20px';
            btn.onclick = () => { if(!input.value) return alert('Enter ID'); close(); onConfirm({ mode:'update', id:input.value.trim(), type:selType, updateOpts: { header:cHead.checked, name: (alreadyHasSuffix || (cName && cName.checked)), grades:cGrade.checked, stakeholders:cStake.checked } }); };
            modal.appendChild(btn);
        } else {
            const h4 = document.createElement('div'); h4.innerHTML='<b>Create New Escalation</b>'; h4.style.borderBottom='1px solid #eee'; h4.style.marginBottom='15px'; h4.style.fontSize='16px'; h4.style.color='#2d3748'; modal.appendChild(h4);
            const btnNew = (l,v) => { const b=document.createElement('button'); b.innerText=l; b.className='ia-btn ia-btn-blue'; b.onclick=()=>{ if(!input.value)return alert('Enter ID'); close(); onConfirm({mode:'new', id:input.value.trim(), type:v, updateOpts:{}}); }; return b; };
            const div = document.createElement('div'); div.style.display='flex'; div.style.gap='10px'; div.style.marginTop='10px';
            div.appendChild(btnNew('Lesson','lesson')); div.appendChild(btnNew('Contact','contact')); div.appendChild(btnNew('Both','both')); modal.appendChild(div);
        }
        const cncl = document.createElement('div'); cncl.innerText='Cancel'; cncl.style.marginTop='20px'; cncl.style.cursor='pointer'; cncl.style.textAlign='center'; cncl.style.color='#718096'; cncl.style.fontSize='14px';
        cncl.onclick=()=>{ close(); }; modal.appendChild(cncl);
    }

    // --- INITIALIZATION ---
    const btn = document.createElement('button');
    btn.className = 'ia-btn-main';
    btn.innerHTML = isActive() ? '⏳ Working...' : '📝 IA Master Tool';

    if (isActive()) { btn.style.background = '#e0a800'; } else { btn.style.background = 'linear-gradient(135deg, #28a745, #218838)'; }

    btn.onclick = function(e) {
        if (isActive()) return;
        sessionStorage.removeItem(KEY_DATA);
        sessionStorage.removeItem(KEY_CHOICE);
        showMasterModal((config) => {
            sessionStorage.setItem(KEY_CONFIG, JSON.stringify(config));
            sessionStorage.setItem(KEY_ACTIVE, 'true');
            updateBtn('⏳ Working...', '#e0a800');
            location.reload();
        });
    };
    document.body.appendChild(btn);
    if (isActive()) { setTimeout(runEngine, 500); }
})();
