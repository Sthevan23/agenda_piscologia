// script.js - PsicoAgenda completo (com CRUD pacientes + Histórico)

// ────────────────────────────────────────────────
// Dados globais
// ────────────────────────────────────────────────

function loadStoredJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : fallback;
    } catch {
        return fallback;
    }
}

/** Data local YYYY-MM-DD (evita erro de fuso com toISOString). */
function toLocalDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

let currentDate = new Date();
let selectedDate = null;
let activeHistoryFilter = 'all'; // Filtro ativo no histórico

// Carrega dados iniciais do localStorage ou inicia vazio
let patients = loadStoredJSON('fisio_patients', []);
let appointments = loadStoredJSON('fisio_appointments', []);

const timeSlots = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00'
];

const appointmentTypes = {
    avaliacao: 'Avaliação Psicológica',
    sessao: 'Sessão de Psicoterapia',
    retorno: 'Retorno',
    pilates: 'Psicoterapia em Grupo',
    reabilitacao: 'Acompanhamento Psicológico'
};

const serviceCategories = {
    particular: 'Particular',
    plano: 'Plano de Saúde',
    domicilio: 'Domicílio'
};

const paymentMethods = {
    dinheiro: 'Dinheiro',
    pix: 'Pix',
    credito: 'Cartão de Crédito',
    debito: 'Cartão de Débito'
};

// ────────────────────────────────────────────────
// Inicialização
// ────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    renderCalendar();
    renderTodayAppointments();
    renderUpcomingAppointments();
    renderPatientSelect();
    renderPatientList();
    renderHistory();           // Novo: renderiza histórico
    generateTimeSlots();
    updateStats();

    const dateInput = document.getElementById('appointmentDate');
    if (dateInput) dateInput.valueAsDate = new Date();

    // Busca pacientes na lista principal
    document.getElementById('patient-search')?.addEventListener('input', e => {
        renderPatientList(e.target.value);
    });

    // Filtra pacientes no select de agendamento
    document.getElementById('patient-select-search')?.addEventListener('input', e => {
        renderPatientSelect(e.target.value);
    });

    // Máscara de telefone
    document.getElementById('patientPhone')?.addEventListener('input', e => {
        e.target.value = formatPhone(e.target.value);
    });

    // Máscara de valor (Real)
    document.getElementById('appointmentValue')?.addEventListener('input', e => {
        e.target.value = formatCurrencyInput(e.target.value);
    });
    document.getElementById('newAppointmentValue')?.addEventListener('input', e => {
        e.target.value = formatCurrencyInput(e.target.value);
    });

    // Classificação de idade ao vivo no modal
    document.getElementById('patientAge')?.addEventListener('input', e => {
        const preview = document.getElementById('age-category-preview');
        const age = e.target.value;
        if (preview) {
            const cat = getAgeCategory(age ? parseInt(age) : null);
            if (cat) {
                preview.textContent = `(${cat.label})`;
                preview.style.color = (cat.class === 'age-child') ? '#0369a1' : (cat.class === 'age-adult' ? '#15803d' : '#be185d');
            } else {
                preview.textContent = '';
            }
        }
    });

    // Busca no histórico
    document.getElementById('history-search')?.addEventListener('input', e => {
        renderHistory(e.target.value, activeHistoryFilter);
    });

    document.getElementById('editValueModal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeEditValueModal();
    });

    // Fechar modais ao clicar fora
    document.getElementById('appointmentModal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.getElementById('patientModal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) closePatientModal();
    });
    document.getElementById('cancelModal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeCancelModal();
    });
});

// ────────────────────────────────────────────────
// CRUD Pacientes
// ────────────────────────────────────────────────

function openPatientModal(editId = null) {
    const modal = document.getElementById('patientModal');
    const title = document.getElementById('patientModalTitle');
    const form = document.getElementById('patientForm');

    if (!modal) return;

    form.reset();
    document.getElementById('editPatientId').value = '';

    if (editId != null && editId !== '') {
        const patient = patients.find(p => p.id == editId);
        if (patient) {
            title.textContent = 'Editar Paciente';
            document.getElementById('patientName').value = patient.name;
            document.getElementById('patientPhone').value = patient.phone;
            document.getElementById('patientAge').value = patient.age || '';
            document.getElementById('editPatientId').value = patient.id;

            // Set gender radio
            const genderRadio = document.querySelector(`input[name="gender"][value="${patient.gender || 'masculino'}"]`);
            if (genderRadio) genderRadio.checked = true;

            // Atualizar preview de idade
            const preview = document.getElementById('age-category-preview');
            if (preview) {
                const cat = getAgeCategory(patient.age);
                if (cat) {
                    preview.textContent = `(${cat.label})`;
                    preview.style.color = (cat.class === 'age-child') ? '#0369a1' : (cat.class === 'age-adult' ? '#15803d' : '#be185d');
                } else {
                    preview.textContent = '';
                }
            }

            // Mostrar botão de excluir
            const delBtn = document.getElementById('btn-delete-patient');
            if (delBtn) delBtn.style.display = 'inline-flex';
        }
    } else {
        title.textContent = 'Novo Paciente';
        document.getElementById('patientForm').reset();
        document.getElementById('editPatientId').value = '';

        // Esconder botão de excluir e limpar preview de idade
        const delBtn = document.getElementById('btn-delete-patient');
        if (delBtn) delBtn.style.display = 'none';

        const preview = document.getElementById('age-category-preview');
        if (preview) preview.textContent = '';
    }
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function deletePatientFromModal() {
    const id = document.getElementById('editPatientId').value;
    if (id) {
        deletePatient(parseInt(id));
        closePatientModal();
    }
}

function closePatientModal() {
    const modal = document.getElementById('patientModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function savePatient() {
    const name = document.getElementById('patientName')?.value.trim();
    const phone = document.getElementById('patientPhone')?.value.trim();
    const age = document.getElementById('patientAge')?.value;
    const gender = document.querySelector('input[name="gender"]:checked')?.value || 'masculino';
    const editId = document.getElementById('editPatientId')?.value;

    if (!name || !phone) {
        showToast('Nome e telefone são obrigatórios', 'error');
        return;
    }

    if (editId) {
        const patient = patients.find(p => p.id == editId);
        if (patient) {
            patient.name = name;
            patient.phone = phone;
            patient.age = age ? parseInt(age) : null;
            patient.gender = gender;
            showToast('Paciente atualizado!');
        }
    } else {
        const newId = patients.length ? Math.max(...patients.map(p => p.id)) + 1 : 1;
        patients.push({ id: newId, name, phone, age: age ? parseInt(age) : null, gender });
        showToast('Paciente adicionado!');
    }

    saveData(); // Persiste no banco local
    renderPatientList();
    renderPatientSelect();
    renderTodayAppointments();
    renderUpcomingAppointments();
    renderHistory();
    closePatientModal();
}

function deletePatient(id) {
    if (confirm('Deseja realmente remover este paciente?')) {
        patients = patients.filter(p => p.id !== id);
        saveData(); // Persiste no banco local
        renderPatientList();
        renderPatientSelect();
        showToast('Paciente removido');
    }
}
// ────────────────────────────────────────────────
// Render Pacientes
// ────────────────────────────────────────────────

function getAgeCategory(age) {
    if (age === null || age === undefined || age === '') return null;
    const n = Number(age);
    if (isNaN(n)) return null;
    if (n <= 12) return { label: 'Criança', class: 'age-child' };
    if (n <= 59) return { label: 'Adulto', class: 'age-adult' };
    return { label: 'Idoso', class: 'age-elderly' };
}

function getAgeBadge(age) {
    const cat = getAgeCategory(age);
    if (!cat) return '';
    // Estilos inline para garantir visibilidade inicial
    return `<span class="age-badge ${cat.class}" style="margin-left:8px; vertical-align:middle; display:inline-block !important;">${cat.label}</span>`;
}

function getGenderBadge(patient) {
    if (!patient) return '';
    let gender = patient.gender;
    if (!gender) {
        // Heurística simples para pacientes sem gênero definido
        const name = patient.name.toLowerCase().trim();
        gender = name.endsWith('a') ? 'feminino' : 'masculino';
    }
    const isMale = gender === 'masculino';
    const color = isMale ? '#3498db' : '#ff6b81';
    const icon = isMale ? 'fa-mars' : 'fa-venus';
    return `<i class="fas ${icon}" style="color: ${color}; margin-left: 5px; font-size: 0.9em;" title="${isMale ? 'Homem' : 'Mulher'}"></i>`;
}

function renderPatientList(search = '') {
    const container = document.getElementById('patient-list');
    if (!container) return;

    const filtered = patients.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.phone.includes(search)
    ).sort((a, b) => a.name.localeCompare(b.name));

    container.innerHTML = filtered.map(p => {
        let gender = p.gender;
        if (!gender) {
            const name = p.name.toLowerCase().trim();
            gender = name.endsWith('a') ? 'feminino' : 'masculino';
        }
        const isMale = gender === 'masculino';
        const iconColor = isMale ? '#3498db' : '#ff6b81';
        const iconClass = isMale ? 'fa-mars' : 'fa-venus';
        const avatarBg = isMale ? 'rgba(52, 152, 219, 0.1)' : 'rgba(255, 107, 129, 0.1)';

        return `
        <div class="patient-item">
            <div class="patient-avatar" style="background: ${avatarBg}; color: ${iconColor};">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="patient-info">
                <div class="patient-name-text">
                    ${p.name} 
                    ${getAgeBadge(p.age)}
                </div>
                <div class="patient-phone-text">${p.phone}</div>
            </div>
            <div class="patient-age-box">
                <div class="patient-age-text">${p.age ? p.age + ' anos' : '—'}</div>
            </div>
            <div class="patient-actions">
                <button class="btn btn-secondary" onclick="openPatientModal(${p.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger-outline" onclick="deletePatient(${p.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `}).join('');
}

function renderPatientSelect(search = '') {
    const select = document.getElementById('patientSelect');
    if (!select) return;

    const filtered = patients
        .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));

    select.innerHTML = '<option value="">Selecione um paciente</option>' +
        filtered.map(p => `<option value="${p.id}">${p.name} - ${p.phone}</option>`).join('');
}

// ────────────────────────────────────────────────
// Histórico de Consultas (NOVO)
// ────────────────────────────────────────────────

function filterHistory(status) {
    activeHistoryFilter = status;

    // Atualiza visual dos botões
    ['all', 'confirmed', 'cancelled'].forEach(s => {
        const btn = document.getElementById('filter-' + s);
        if (!btn) return;
        if (s === status) {
            btn.style.background = 'var(--primary)';
            btn.style.color = '#fff';
            btn.style.border = 'none';
        } else {
            btn.style.background = 'transparent';
            btn.style.color = 'var(--text-light)';
            btn.style.border = '1px solid var(--border)';
        }
    });

    const searchInput = document.getElementById('history-search');
    renderHistory(searchInput ? searchInput.value : '', activeHistoryFilter);
}

function renderHistory(search = '', statusFilter = 'all') {
    const container = document.getElementById('history-list');
    if (!container) return;

    let filtered = appointments.slice();

    // Filtra por status (confirmados no histórico inclui finalizados — ainda não cancelados)
    if (statusFilter === 'confirmed') {
        filtered = filtered.filter(app => app.status === 'confirmed' || app.status === 'finished');
    } else if (statusFilter !== 'all') {
        filtered = filtered.filter(app => app.status === statusFilter);
    }

    // Ordena por data + hora (mais recente primeiro)
    filtered.sort((a, b) => new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time));

    if (search) {
        const lowerSearch = search.toLowerCase();
        filtered = filtered.filter(app => {
            const patient = patients.find(p => p.id == app.patientId);
            const patientName = patient ? patient.name.toLowerCase() : '';
            return patientName.includes(lowerSearch) ||
                app.date.includes(search) ||
                app.time.includes(search);
        });
    }

    container.innerHTML = filtered.length === 0
        ? `<div style="text-align:center; padding:3rem 1rem;">
               <i class="fas fa-calendar-xmark" style="font-size:2.5rem; color:var(--border); margin-bottom:1rem; display:block;"></i>
               <p style="color:var(--text-light);">Nenhuma consulta encontrada.</p>
           </div>`
        : filtered.map(app => {
            const patient = patients.find(p => p.id == app.patientId);
            const isCancelled = app.status === 'cancelled';
            const ageCat = patient ? getAgeCategory(patient.age) : null;
            const borderColor = isCancelled ? 'var(--danger)' : 'var(--success)';
            return `
                <div class="appointment-item ${isCancelled ? 'cancelled-item' : ''}" data-status="${app.status}" style="flex-direction: column; align-items: stretch; gap: 0.5rem; padding: 1rem;">
                    <div style="display: flex; align-items: center; gap: 1rem; width: 100%;">
                        <div class="appointment-time">
                            <span class="time-start">${formatDate(app.date)}</span>
                            <span class="time-end">${app.time}</span>
                        </div>
                        <div class="appointment-details">
                            <div class="patient-name">
                                ${patient ? patient.name : 'Paciente removido'}
                                ${getGenderBadge(patient)}
                                ${getAgeBadge(patient ? patient.age : null)}
                            </div>
                            <div class="appointment-type">
                                ${appointmentTypes[app.type] || app.type} 
                                ${app.payment ? `<small style="background:rgba(0,0,0,0.05); padding:2px 6px; border-radius:4px; font-size:0.7rem; margin-left:4px;">${paymentMethods[app.payment] || app.payment}</small>` : ''}
                                ${app.value ? `- <span style="color:var(--success); font-weight:700;">${formatCurrency(app.value)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="appointment-actions">
                        <span class="status-badge status-${app.status}" style="margin-right: auto; padding: 4px 12px; font-size: 0.75rem;">
                            ${isCancelled ? 'Cancelado' : (app.status === 'finished' ? 'Finalizado' : 'Confirmado')}
                        </span>
                        ${(!isCancelled && app.status !== 'finished') ? `
                            <button class="btn-appt btn-appt-finish" onclick="finishAppointment(${app.id})" title="Finalizar"><i class="fas fa-check"></i> Finalizar</button>
                            <button class="btn-appt btn-appt-cancel" onclick="confirmCancelAppointment(${app.id})" title="Cancelar"><i class="fas fa-ban"></i> Cancelar</button>
                        ` : ''}
                        ${app.status === 'finished' ? `
                            <button class="btn-appt btn-appt-cancel" onclick="openEditValueModal(${app.id})" title="Editar Valor" style="background:rgba(52, 152, 219, 0.1); color:var(--primary); border-color:var(--primary); min-width:80px;"><i class="fas fa-edit"></i> Valor</button>
                            <button class="btn-appt" onclick="revertBilling(${app.id})" title="Reverter Faturamento" style="background:#fff3e0; color:#e65100; border:1px solid #ffb74d; min-width:90px;"><i class="fas fa-undo"></i> Estornar</button>
                            <button class="btn-appt btn-appt-cancel btn-appt-icon" onclick="deleteAppointment(${app.id})" title="Excluir"><i class="fas fa-trash"></i></button>
                        ` : ''}
                        ${isCancelled ? `
                             <button class="btn-appt btn-appt-cancel btn-appt-icon" onclick="deleteAppointment(${app.id})" title="Excluir"><i class="fas fa-trash"></i></button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
}

// ────────────────────────────────────────────────
// Calendário e Agendamentos (mantidos)
// ────────────────────────────────────────────────

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);

    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    const prevDays = prevLastDay.getDate();

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    document.getElementById('current-month').textContent = `${monthNames[month]} ${year}`;

    let html = '';
    const dayHeaders = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    dayHeaders.forEach(day => html += `<div class="calendar-day-header">${day}</div>`);

    // Dias do mês anterior
    for (let i = startingDay - 1; i >= 0; i--) {
        const d = new Date(year, month, -i);
        const dateStr = toLocalDateStr(d);
        const dayApps = appointments.filter(a => a.date === dateStr);
        let dots = '';
        dayApps.forEach(a => dots += `<div class="appointment-dot ${a.status}"></div>`);

        html += `<div class="calendar-day other-month" onclick="selectDate('${dateStr}')">
            <div class="day-number">${d.getDate()}</div>
            <div class="day-appointments">${dots}</div>
        </div>`;
    }

    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const isToday = today.getDate() === i && today.getMonth() === month && today.getFullYear() === year;
        const dayApps = appointments.filter(a => a.date === dateStr);

        let dots = '';
        dayApps.forEach(a => dots += `<div class="appointment-dot ${a.status}"></div>`);

        html += `<div class="calendar-day ${isToday ? 'today' : ''}" onclick="selectDate('${dateStr}')">
            <div class="day-number">${i}</div>
            <div class="day-appointments">${dots}</div>
        </div>`;
    }

    // Dias do próximo mês
    const remaining = 42 - (startingDay + daysInMonth);
    for (let i = 1; i <= remaining; i++) {
        const d = new Date(year, month + 1, i);
        const dateStr = toLocalDateStr(d);
        const dayApps = appointments.filter(a => a.date === dateStr);
        let dots = '';
        dayApps.forEach(a => dots += `<div class="appointment-dot ${a.status}"></div>`);

        html += `<div class="calendar-day other-month" onclick="selectDate('${dateStr}')">
            <div class="day-number">${d.getDate()}</div>
            <div class="day-appointments">${dots}</div>
        </div>`;
    }

    document.getElementById('calendar').innerHTML = html;
}

function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar();
}

function changeYear(delta) {
    currentDate.setFullYear(currentDate.getFullYear() + delta);
    renderCalendar();
}

function goToToday() {
    currentDate = new Date();
    renderCalendar();
}

function selectDate(date) {
    selectedDate = date;
    document.getElementById('appointmentDate').value = date;
    openModal();
}

function renderTodayAppointments() {
    const today = toLocalDateStr(new Date());
    const todayApps = appointments.filter(a => a.date === today)
        .sort((a, b) => a.time.localeCompare(b.time));

    const badge = document.getElementById('today-count-badge');
    if (badge) {
        const n = todayApps.filter(a => a.status !== 'cancelled').length;
        badge.textContent = n === 1 ? '1 agendada' : `${n} agendadas`;
    }

    document.getElementById('today-appointments').innerHTML = todayApps.map(app => {
        const p = patients.find(p => p.id == app.patientId);
        const isCancelled = app.status === 'cancelled';
        const ageCat = p ? getAgeCategory(p.age) : null;
        return `
            <div class="appointment-item ${isCancelled ? 'cancelled-item' : ''}" style="flex-direction: column; align-items: stretch; gap: 0.5rem; padding: 1rem;">
                <div style="display: flex; align-items: center; gap: 1rem; width: 100%;">
                    <div class="appointment-time">
                        <span class="time-start">${app.time}</span>
                        <span class="time-end">${calculateEndTime(app.time)}</span>
                    </div>
                    <div class="appointment-details">
                        <div class="patient-name">
                            ${p ? p.name : 'Paciente removido'}
                            ${getGenderBadge(p)}
                            ${getAgeBadge(p ? p.age : null)}
                        </div>
                        <div class="appointment-type">${appointmentTypes[app.type]}</div>
                    </div>
                </div>
                <div class="appointment-actions">
                    ${isCancelled ? '<span class="status-badge status-cancelled">Cancelado</span>' : (app.status === 'finished' ? '<span class="status-badge status-finished" style="background:rgba(46, 213, 115, 0.1); color:var(--success);">Finalizado</span>' : `
                        <button class="btn-appt btn-appt-finish" onclick="finishAppointment(${app.id})" title="Finalizar"><i class="fas fa-check"></i> Finalizar</button>
                        <button class="btn-appt btn-appt-cancel" onclick="confirmCancelAppointment(${app.id})" title="Cancelar"><i class="fas fa-ban"></i> Cancelar</button>
                    `)}
                </div>
            </div>
        `;
    }).join('');
}

function renderUpcomingAppointments() {
    const today = toLocalDateStr(new Date());
    const upcoming = appointments.filter(a => a.date > today).slice(0, 5);

    document.getElementById('upcoming-appointments').innerHTML = upcoming.map(app => {
        const p = patients.find(p => p.id == app.patientId);
        const isCancelled = app.status === 'cancelled';
        const ageCat = p ? getAgeCategory(p.age) : null;
        return `
            <div class="appointment-item ${isCancelled ? 'cancelled-item' : ''}" style="flex-direction: column; align-items: stretch; gap: 0.5rem; padding: 1rem;">
                <div style="display: flex; align-items: center; gap: 1rem; width: 100%;">
                    <div class="appointment-time">
                        <span class="time-start">${formatDate(app.date)}</span>
                        <span class="time-end">${app.time}</span>
                    </div>
                    <div class="appointment-details">
                        <div class="patient-name">
                            ${p ? p.name : 'Paciente removido'}
                            ${getAgeBadge(p ? p.age : null)}
                        </div>
                        <div class="appointment-type">${appointmentTypes[app.type]}</div>
                    </div>
                </div>
                <div class="appointment-actions">
                    ${isCancelled ? '<span class="status-badge status-cancelled">Cancelado</span>' : (app.status === 'finished' ? '<span class="status-badge status-finished" style="background:rgba(46, 213, 115, 0.1); color:var(--success);">Finalizado</span>' : `
                        <button class="btn-appt btn-appt-finish" onclick="finishAppointment(${app.id})" title="Finalizar"><i class="fas fa-check"></i> Finalizar</button>
                        <button class="btn-appt btn-appt-cancel" onclick="confirmCancelAppointment(${app.id})" title="Cancelar"><i class="fas fa-ban"></i> Cancelar</button>
                    `)}
                </div>
            </div>
        `;
    }).join('');
}

function calculateEndTime(start) {
    const [h, m] = start.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m + 50);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDate(dateStr) {
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    const dt = new Date(y, m - 1, d);
    return `${dt.getDate()}/${dt.getMonth() + 1}`;
}

function openModal() {
    // Definir data mínima como ontem (data local)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toLocalDateStr(yesterday);
    document.getElementById('appointmentDate').setAttribute('min', yesterdayStr);

    document.getElementById('appointmentModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('appointmentModal').classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('appointmentForm').reset();
    const searchInput = document.getElementById('patient-select-search');
    if (searchInput) {
        searchInput.value = '';
        renderPatientSelect();
    }
    document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
}

function generateTimeSlots() {
    document.getElementById('timeSlots').innerHTML = timeSlots.map(t =>
        `<div class="time-slot" onclick="selectTime(this,'${t}')">${t}</div>`
    ).join('');
}

function selectTime(el, time) {
    document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('selectedTime').value = time;
}

function saveAppointment() {
    const patientId = document.getElementById('patientSelect').value;
    const date = document.getElementById('appointmentDate').value;
    const time = document.getElementById('selectedTime').value;

    // Validação de data (mínimo ontem)
    const selectedDate = new Date(date + 'T00:00:00');
    const yesterday = new Date();
    yesterday.setHours(0, 0, 0, 0);
    yesterday.setDate(yesterday.getDate() - 1);

    if (selectedDate < yesterday) {
        return showToast('Não é possível agendar consultas antes de ontem.', 'error');
    }

    const type = document.getElementById('appointmentType').value;
    const valueInput = document.getElementById('appointmentValue').value;
    const category = document.getElementById('appointmentCategory').value;
    const payment = document.getElementById('appointmentPayment').value;

    if (!patientId) return showToast('Selecione um paciente', 'error');
    if (!date) return showToast('Selecione a data', 'error');
    if (!time) return showToast('Selecione um horário', 'error');
    if (!valueInput || valueInput === 'R$ 0,00') return showToast('Informe o valor da consulta', 'error');
    if (!category) return showToast('Selecione a categoria', 'error');
    if (!payment) return showToast('Selecione a forma de pagamento', 'error');

    // Converte "R$ 150,00" para 150.00
    const cleanValue = valueInput.replace(/[^\d,]/g, '').replace(',', '.');
    const value = parseFloat(cleanValue);

    if (isNaN(value) || value <= 0) {
        showToast('Informe um valor válido', 'error');
        return;
    }

    const patient = patients.find(p => p.id == patientId);
    if (!patient) {
        showToast('Paciente não encontrado', 'error');
        return;
    }

    appointments.push({
        id: Date.now(), // ID único baseado em timestamp
        patientId: patient.id,
        patient: patient.name,
        date,
        time,
        type,
        value: parseFloat(value),
        category,
        payment,
        status: 'confirmed'
    });

    appointments.sort((a, b) => new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time));

    saveData(); // Persiste no banco local
    renderCalendar();
    renderTodayAppointments();
    renderUpcomingAppointments();
    renderHistory();
    updateStats();
    closeModal();
    showToast('Consulta agendada!');
}

function finishAppointment(id) {
    const app = appointments.find(a => a.id === id);
    if (app) {
        app.status = 'finished';
        saveData();
        renderCalendar();
        renderTodayAppointments();
        renderUpcomingAppointments();
        renderHistory();
        renderReports(); // Atualiza relatórios imediatamente
        updateStats();
        showToast('Atendimento finalizado com sucesso!');
    }
}

function revertBilling(id) {
    if (confirm('Deseja reverter o faturamento desta consulta? O status voltará para "Confirmado".')) {
        const app = appointments.find(a => a.id === id);
        if (app) {
            app.status = 'confirmed';
            saveData();
            renderCalendar();
            renderTodayAppointments();
            renderUpcomingAppointments();
            renderHistory();
            updateStats();
            showToast('Faturamento revertido.');
        }
    }
}

function deleteAppointment(id) {
    if (confirm('Tem certeza que deseja excluir permanentemente esta consulta?')) {
        appointments = appointments.filter(a => a.id !== id);
        saveData();
        renderCalendar();
        renderTodayAppointments();
        renderUpcomingAppointments();
        renderHistory();
        updateStats();
        showToast('Consulta excluída permanentemente.');
    }
}

function openEditValueModal(id) {
    const app = appointments.find(a => a.id === id);
    if (!app) return;

    const modal = document.getElementById('editValueModal');
    document.getElementById('editValueApptId').value = id;
    document.getElementById('newAppointmentValue').value = formatCurrency(app.value || 0);
    document.getElementById('editAppointmentPayment').value = app.payment || 'dinheiro';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeEditValueModal() {
    const modal = document.getElementById('editValueModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function saveNewValue() {
    const id = parseInt(document.getElementById('editValueApptId').value);
    const valueInput = document.getElementById('newAppointmentValue').value;
    const payment = document.getElementById('editAppointmentPayment').value;

    const cleanValue = valueInput.replace(/[^\d,]/g, '').replace(',', '.');
    const value = parseFloat(cleanValue);

    if (isNaN(value) || value < 0) {
        showToast('Informe um valor válido', 'error');
        return;
    }

    const app = appointments.find(a => a.id === id);
    if (app) {
        app.value = value;
        app.payment = payment;
        saveData();
        renderHistory();
        renderReports(); // Atualiza faturamento imediatamente se estiver na aba
        showToast('Valor atualizado com sucesso!');
        closeEditValueModal();
    }
}

function updateStats() {
    const today = toLocalDateStr(new Date());
    const todayCount = appointments.filter(a => a.date === today && a.status !== 'cancelled').length;
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStr = toLocalDateStr(weekStart);
    const weekCount = appointments.filter(a => a.date >= weekStr && a.status !== 'cancelled').length;
    const confirmed = appointments.filter(a => a.status === 'confirmed').length;
    const finished = appointments.filter(a => a.status === 'finished').length;
    const cancelled = appointments.filter(a => a.status === 'cancelled').length;

    document.getElementById('today-count').textContent = todayCount;
    document.getElementById('week-count').textContent = weekCount;
    document.getElementById('confirmed-count').textContent = confirmed; // Mantendo count de confirmados agendados

    // Se houver um local para "Finalizados" nos stats, poderíamos usar:
    // Mas por enquanto, vamos apenas garantir que os cancelados não contem.
    document.getElementById('cancelled-count').textContent = cancelled;
}

// ────────────────────────────────────────────────
// Cancelamento de Consultas
// ────────────────────────────────────────────────

function confirmCancelAppointment(id) {
    const app = appointments.find(a => a.id === id);
    if (!app) return;
    const patient = patients.find(p => p.id == app.patientId);
    const name = patient ? patient.name : 'paciente';

    const modal = document.getElementById('cancelModal');
    document.getElementById('cancel-patient-name').textContent = name;
    document.getElementById('cancel-appt-date').textContent = formatDate(app.date) + ' às ' + app.time;
    document.getElementById('cancel-appt-type').textContent = appointmentTypes[app.type] || app.type;
    modal.dataset.appointmentId = id;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCancelModal() {
    const modal = document.getElementById('cancelModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function executeCancelAppointment() {
    const modal = document.getElementById('cancelModal');
    const id = parseInt(modal.dataset.appointmentId);
    const app = appointments.find(a => a.id === id);
    if (app) {
        app.status = 'cancelled';
        saveData(); // Persiste no banco local
        renderCalendar();
        renderTodayAppointments();
        renderUpcomingAppointments();
        renderHistory();
        updateStats();
        showToast('Consulta cancelada.', 'cancelled');
    }
    closeCancelModal();
}

// ────────────────────────────────────────────────
// Auxiliares
// ────────────────────────────────────────────────

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;

    const titleEle = document.getElementById('toast-title');
    const messageEle = document.getElementById('toast-message');
    const iconContainer = t.querySelector('.toast-icon');
    const icon = iconContainer.querySelector('i');

    // Reset classes
    t.classList.remove('error', 'cancelled');

    messageEle.textContent = msg;

    if (type === 'error' || type === 'cancelled') {
        titleEle.textContent = type === 'error' ? 'Erro' : 'Cancelado';
        icon.className = type === 'error' ? 'fas fa-exclamation-circle' : 'fas fa-ban';
        t.style.borderLeft = '4px solid #ff4757';
        iconContainer.style.background = 'rgba(255, 71, 87, 0.1)';
        iconContainer.style.color = '#ff4757';
    } else {
        titleEle.textContent = 'Sucesso!';
        icon.className = 'fas fa-check';
        t.style.borderLeft = '4px solid #2ed573';
        iconContainer.style.background = 'rgba(46, 213, 115, 0.1)';
        iconContainer.style.color = '#2ed573';
    }

    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function formatPhone(value) {
    // Remove tudo que não é número
    let digits = value.replace(/\D/g, '');

    // Limita a 11 dígitos (celular com DDD)
    if (digits.length > 11) digits = digits.slice(0, 11);

    // Formata progressivamente
    if (digits.length <= 2) {
        return digits.length ? '(' + digits : '';
    } else if (digits.length <= 6) {
        return '(' + digits.slice(0, 2) + ') ' + digits.slice(2);
    } else if (digits.length === 11) {
        // Celular: (37) 9 9124-4506
        return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 3) + ' ' + digits.slice(3, 7) + '-' + digits.slice(7);
    } else {
        // Fixo: (37) 9124-4506
        return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 6) + '-' + digits.slice(6);
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;
    sidebar.classList.toggle('active');
    overlay?.classList.toggle('active');
}

function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    const target = document.getElementById(section + '-section');
    if (target) target.style.display = 'block';

    if (section === 'reports') {
        renderReports();
    }

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const link = document.querySelector(`.nav-link[onclick="showSection('${section}')"]`);
    if (link) link.classList.add('active');

    // Fechar sidebar no mobile após clique
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('sidebar-overlay')?.classList.remove('active');
    }
}

function saveData() {
    localStorage.setItem('fisio_patients', JSON.stringify(patients));
    localStorage.setItem('fisio_appointments', JSON.stringify(appointments));
}

function formatCurrencyInput(value) {
    let v = value.replace(/\D/g, '');
    v = (v / 100).toFixed(2) + '';
    v = v.replace(".", ",");
    v = v.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,");
    v = v.replace(/(\d)(\d{3}),/g, "$1.$2,");
    return "R$ " + v;
}

// ────────────────────────────────────────────────
// Relatórios e Financeiro
// ────────────────────────────────────────────────

function renderReports() {
    const finishedApps = appointments.filter(a => a.status === 'finished');

    // Faturamento Total
    const totalRevenue = finishedApps.reduce((acc, app) => acc + (app.value || 0), 0);
    document.getElementById('total-revenue').textContent = formatCurrency(totalRevenue);

    // Faturamento Mensal (Mês atual)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyApps = finishedApps.filter(app => {
        // Usar T00:00:00 para evitar problemas de fuso horário
        const appDate = new Date(app.date + 'T00:00:00');
        return appDate.getMonth() === currentMonth && appDate.getFullYear() === currentYear;
    });
    const monthlyRevenue = monthlyApps.reduce((acc, app) => acc + (app.value || 0), 0);
    document.getElementById('monthly-revenue').textContent = formatCurrency(monthlyRevenue);

    // Média por Consulta
    const avgValue = finishedApps.length ? totalRevenue / finishedApps.length : 0;
    document.getElementById('average-value').textContent = formatCurrency(avgValue);

    // Faturamento por Categoria
    const revenueByCategory = {};
    const atendsByCategory = {};

    Object.keys(serviceCategories).forEach(cat => {
        revenueByCategory[cat] = 0;
        atendsByCategory[cat] = 0;
    });

    const revenueByPayment = {
        dinheiro: 0,
        pix: 0,
        cartao: 0
    };
    const atendsByPayment = {
        dinheiro: 0,
        pix: 0,
        cartao: 0
    };

    finishedApps.forEach(app => {
        if (app.category && revenueByCategory.hasOwnProperty(app.category)) {
            revenueByCategory[app.category] += (app.value || 0);
            atendsByCategory[app.category]++;
        }

        if (app.payment === 'dinheiro') {
            revenueByPayment.dinheiro += (app.value || 0);
            atendsByPayment.dinheiro++;
        } else if (app.payment === 'pix') {
            revenueByPayment.pix += (app.value || 0);
            atendsByPayment.pix++;
        } else if (app.payment === 'credito' || app.payment === 'debito') {
            revenueByPayment.cartao += (app.value || 0);
            atendsByPayment.cartao++;
        }
    });

    // Renderizar Faturamento por Categoria
    document.getElementById('revenue-by-category').innerHTML = Object.entries(serviceCategories).map(([key, label]) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
            <span style="font-weight: 500;">${label}</span>
            <span style="font-weight: 700; color: var(--success);">${formatCurrency(revenueByCategory[key])}</span>
        </div>
    `).join('');

    // Renderizar Faturamento por Pagamento (Agrupado)
    const paymentLabels = {
        dinheiro: 'Dinheiro',
        pix: 'Pix',
        cartao: 'Cartão (C/D)'
    };

    document.getElementById('revenue-by-payment').innerHTML = Object.entries(paymentLabels).map(([key, label]) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
            <div style="display: flex; flex-direction: column;">
                <span style="font-weight: 500;">${label}</span>
                <small style="color: var(--text-light); font-size: 0.75rem;">${atendsByPayment[key]} pessoas</small>
            </div>
            <span style="font-weight: 700; color: var(--success);">${formatCurrency(revenueByPayment[key])}</span>
        </div>
    `).join('');

    // Renderizar Distribuição de Atendimentos
    document.getElementById('atends-by-category').innerHTML = Object.entries(serviceCategories).map(([key, label]) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
            <span style="font-weight: 500;">${label}</span>
            <span style="font-weight: 700; color: var(--primary);">${atendsByCategory[key]} atendimentos</span>
        </div>
    `).join('');
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}