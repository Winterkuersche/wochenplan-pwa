(function (root) {
  "use strict";
  // Date inputs are whole calendar days in Germany, including DST changes.
  function berlinBoundary(date, nextDay = false) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Bitte Beginn und letzten Vertretungstag auswählen.");
    const [y,m,d] = date.split("-").map(Number);
    const target = Date.UTC(y,m-1,d + (nextDay ? 1 : 0));
    let guess = target;
    const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23" });
    for (let i=0;i<3;i++) {
      const p=Object.fromEntries(formatter.formatToParts(new Date(guess)).map(v=>[v.type,v.value]));
      const displayed=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
      guess += target-displayed;
    }
    return new Date(guess).toISOString();
  }
  function mount(options) {
    const el = id => document.getElementById(id);
    const panel = el("collaborationPanel");
    let controller, current, events = [], pageBefore = null, visitAfter = 0, preview = null;
    let pollTimer = null, disposed = false, proposalKey = "";
    const fmt = value => value ? new Intl.DateTimeFormat("de-DE", { timeZone:"Europe/Berlin", dateStyle:"short", timeStyle:"short" }).format(new Date(value)) : "";
    const message = text => { el("dataActionMessage").textContent = text; };
    const clear = id => el(id).replaceChildren();
    function markProposalCells() {
      const proposals = current?.branch?.proposals?.filter(p => p.status === "pending") || [];
      for (const cell of document.querySelectorAll("#grid .cell[data-eid][data-day], #monthView .monthCellClickable[data-emp-id][data-iso]")) {
        const count = proposals.filter(p => root.WochenplanProposals.pending(p).some(c => root.WochenplanProposals.affectsCell(c, cell.dataset.day || cell.dataset.iso, cell.dataset.eid || cell.dataset.empId))).length;
        let mark = cell.querySelector(".sharedProposalMark");
        if (!count) { mark?.remove(); continue; }
        if (!mark) { mark = document.createElement("span"); mark.className = "sharedProposalMark"; cell.append(mark); }
        const label = `${count} offene${count === 1 ? "r Vorschlag" : " Vorschläge"}`;
        if (mark.textContent !== label) mark.textContent = label;
      }
    }
    function queueRefresh() {
      if (pollTimer || disposed || !current?.user || !current.selected || document.hidden || navigator.onLine === false) return;
      pollTimer = setTimeout(async () => {
        pollTimer = null;
        if (!disposed && current?.selected && !document.hidden && navigator.onLine !== false) await controller.refresh();
        queueRefresh();
      }, options.pollMs ?? 15000);
    }
    function pauseRefresh() { if (pollTimer) clearTimeout(pollTimer); pollTimer = null; }
    function visibility() { if (document.hidden) pauseRefresh(); else queueRefresh(); }
    function paragraph(parent, text) { const p=document.createElement("p"); p.textContent=text; parent.append(p); return p; }
    function button(parent, text, handler) {
      const b=document.createElement("button"); b.type="button"; b.textContent=text; b.disabled=Boolean(current?.busy);
      b.addEventListener("click",()=>run(handler)); parent.append(b); return b;
    }
    function setOptions(id, values, placeholder) {
      const select=el(id), previous=select.value;
      select.replaceChildren();
      for (const [value,text] of [...(placeholder ? [["",placeholder]] : []),...values]) {
        const option=document.createElement("option"); option.value=value; option.textContent=text; select.append(option);
      }
      if (Array.from(select.options).some(o=>o.value===previous)) select.value=previous;
    }
    const kinds={created:"Filiale angelegt",joined:"Beigetreten",save:"Plan geändert",propose:"Vorschlag eingereicht",decide_proposal:"Vorschlag entschieden",decide_proposal_items:"Vorschlag teilweise entschieden",grant:"Vertretung freigegeben",revoke_grant:"Vertretung beendet",remove_member:"Zugang beendet",invite:"Einladung erstellt",revoke_invite:"Einladung widerrufen",revert:"Änderung zurückgenommen",restore:"Stand wiederhergestellt",publish:"Woche freigegeben",checkpoint:"Sicherungsstand angelegt"};
    function changes(parent, list) {
      for(const c of list || []) {
        if(c.action) {
          const d=c.details||{},name=current?.branch?.members.find(m=>m.id===d.user_id)?.name||"Mitglied";
          const text=c.action==="grant"?`${name}: ${fmt(d.starts_at)} bis ${fmt(d.ends_at)}${d.can_publish?" · mit Wochenfreigabe":""}`
            :c.action==="remove_member"?`Zugang von ${name} beendet`
            :c.action==="revoke_grant"?`Vertretungsrechte von ${name} beendet`
            :c.action==="publish"?`Woche ab ${d.week_start}`
            :c.action==="checkpoint"?(d.label||"Sicherungsstand"):(kinds[c.action]||c.action);
          paragraph(parent,text);continue;
        }
        const path=c.path || [];
        const employees=current?.branch?.payload?.storage?.wochenplan_master_v10?.employees || [];
        let title=path.slice(2).join(" / ");
        if(path[2]==="schedule") title=`${path[3] || "Planung"} · ${employees.find(e=>e.id===path[4])?.name || path[4] || "Tag"}`;
        if(path[1]==="wochenplan_master_v10") title="Teamdaten · "+path.slice(2).join(" / ");
        const detail=document.createElement("details"),summary=document.createElement("summary");
        const shift=v => v && typeof v==="object" && (v.start || v.code) ? `${v.code || "Schicht"} ${v.start || ""}–${v.end || ""}` : null;
        summary.textContent=title+(shift(c.before)||shift(c.after)?` · ${shift(c.before)||"leer"} → ${shift(c.after)||"leer"}`:"");
        detail.append(summary);
        const before=document.createElement("pre");before.textContent=`Vorher: ${JSON.stringify(c.before,null,2)}\nNachher: ${JSON.stringify(c.after,null,2)}`;
        detail.append(before);parent.append(detail);
        if (c.decision) paragraph(parent, `${c.decision === "accepted" ? "Angenommen" : "Abgelehnt"}${c.decided_by_name ? " von " + c.decided_by_name : ""} · ${fmt(c.decided_at)}`);
      }
    }
    function renderEvents() {
      clear("sharedEvents");
      const actor=el("sharedActorFilter").value, week=el("sharedHistoryWeek").value;
      const end=week ? new Date(Date.parse(week+"T12:00:00Z")+6*86400000).toISOString().slice(0,10) : null;
      const filtered=events.filter(e=>(!actor||e.actor_id===actor)&&(!el("sharedSinceVisit").checked||e.id>visitAfter)&&
        (!week||!e.changes.length||e.changes.some(c=>!c.path||c.path[2]!=="schedule"||(c.path[3]>=week&&c.path[3]<=end))));
      if(!filtered.length) paragraph(el("sharedEvents"),"Keine passenden Änderungen in den geladenen Einträgen.");
      for(const event of filtered) {
        const card=document.createElement("article");card.className="sharedEvent";
        paragraph(card,`${event.actor_name} · ${fmt(event.created_at)} · ${kinds[event.kind]||event.kind}`);
        if(event.reason) paragraph(card,event.reason);
        changes(card,event.changes);
        if(current.branch.owner && event.revision && event.changes.length && !event.changes.every(c => c.decision === "rejected")) button(card,"Diese Änderung zurücknehmen",async()=>{
          if(confirm("Diese Änderung zurücknehmen? Spätere Änderungen werden vorher auf Überschneidungen geprüft.")) {
            await controller.perform("revert",{id:event.id}); message("Rücknahme online gespeichert. Bitte den Filialplan auf dieses Gerät übernehmen.");
          }
        });
        el("sharedEvents").append(card);
      }
    }
    function render(status) {
      current=status;
      panel.classList.toggle("hidden",!status.user);
      el("btnSharedProposalOverview").classList.toggle("hidden", !status.branch);
      if (!status.user || !status.selected) pauseRefresh(); else queueRefresh();
      if (!status.branch) { proposalKey = ""; markProposalCells(); }
      el("sharedMessage").textContent=status.message;
      const singleAccountPlan=status.resolved&&!status.busy&&!status.selected&&!status.branches.length;
      el("personalCloudActions").classList.toggle("hidden",!singleAccountPlan);
      el("personalCloudHistory").classList.toggle("hidden",!singleAccountPlan);
      el("cloudRemoteSummary").classList.toggle("hidden",!singleAccountPlan);
      el("sharedSetup").classList.toggle("hidden",!status.resolved||Boolean(status.selected)||Boolean(status.branches.length));
      el("sharedBranchPicker").classList.toggle("hidden",status.branches.length<=1&&(!status.selected||!status.branches.length||status.branches.some(b=>b.id===status.selected)));
      el("sharedSelected").classList.toggle("hidden",!status.branch);
      el("sharedPlanNotice").classList.toggle("hidden",!status.selected);
      if(status.user&&!singleAccountPlan) {
        el("cloudMessage").textContent=status.message;
        el("dataStatus").textContent=status.mode==="synced"?"Filialplan aktuell":"Filialplan prüfen";
        el("dataStatus").dataset.mode=status.mode;
      }
      if(status.selected) {
        el("sharedPlanNotice").textContent=`${status.branch?.name||"Gemeinsame Filiale"} · ${status.message}`;
        el("dataStatus").textContent=status.mode==="synced"?"Filialplan aktuell":"Filialplan prüfen";
        el("dataStatus").dataset.mode=status.mode;
      }
      setOptions("sharedBranchSelect",status.branches.map(b=>[b.id,b.name]),status.branches.some(b=>b.id===status.selected)?null:"Filiale auswählen");
      el("sharedBranchSelect").value=status.selected||"";
      panel.querySelectorAll("button[data-network]").forEach(b=>{b.disabled=status.busy;});
      el("sharedBranchSelect").disabled=status.busy;
      if(!status.branch) return;
      const branch=status.branch;
      el("sharedSummary").textContent=`${branch.name} · Stand ${branch.revision} · ${fmt(branch.updated_at)} · ${branch.owner?"Filialverwaltung":branch.can_edit?"Vertretung darf bearbeiten":"Ansehen und Vorschläge"}`;
      el("sharedOwner").classList.toggle("hidden",!branch.owner);
      el("btnSharedSave").disabled=status.busy||!branch.can_edit;
      el("btnSharedConfirmSave").disabled=status.busy||!branch.can_edit;
      el("btnSharedPublish").disabled=status.busy||!branch.can_publish;
      el("btnSharedCheckpoint").disabled=status.busy||!branch.owner;
      el("btnSharedRestore").disabled=status.busy||!branch.owner;
      setOptions("sharedMember",branch.members.filter(m=>m.active&&!m.owner).map(m=>[m.id,m.name]),"Person auswählen");
      setOptions("sharedActorFilter",branch.members.map(m=>[m.id,m.name]),"Alle");
      setOptions("sharedSnapshotSelect",branch.snapshots.map(s=>[s.id,`${s.label} · Stand ${s.revision} · ${fmt(s.created_at)}`]));
      clear("sharedGrants");
      for(const grant of branch.delegations) {
        const p=paragraph(el("sharedGrants"),`${branch.members.find(m=>m.id===grant.user_id)?.name||"Mitglied"}: ${fmt(grant.starts_at)} bis ${fmt(grant.ends_at)}${grant.can_publish?" · darf Wochen freigeben":""}`);
        button(p,"Freigabe beenden",()=>controller.perform("revoke_grant",{id:grant.id}));
      }
      clear("sharedInvites");
      for(const invite of branch.invites) button(el("sharedInvites"),`Einladung bis ${fmt(invite.expires_at)} widerrufen`,()=>controller.perform("revoke_invite",{id:invite.id}));
      const pending = branch.proposals.filter(p => p.status === "pending");
      el("sharedProposalTitle").textContent = el("btnSharedProposalOverview").textContent = `Offene Vorschläge (${pending.length})`;
      el("sharedDraftHint").textContent = !branch.can_edit && ["draft", "compare"].includes(status.mode)
        ? "Du siehst einen eigenen Geräte-Entwurf. Er ist noch nicht verbindlich. Reiche ihn als Vorschlag ein; bis dahin wird er nicht durch neue Online-Stände ersetzt."
        : "Eingereichte Vorschläge bleiben getrennt vom verbindlichen Plan gespeichert – bis zur Entscheidung und danach unter Erledigte Vorschläge.";
      const nextKey = JSON.stringify([branch.proposals, branch.payload, branch.owner, branch.capabilities]);
      if (nextKey !== proposalKey) {
      proposalKey = nextKey;
      clear("sharedProposals"); clear("sharedResolvedProposals");
      if (!pending.length) paragraph(el("sharedProposals"), "Keine offenen Vorschläge.");
      for(const proposal of branch.proposals) {
        const card=document.createElement("article");card.className="sharedEvent";
        card.dataset.proposalId = proposal.id;
        const items = root.WochenplanProposals.items(proposal), open = root.WochenplanProposals.pending(proposal);
        const itemActions = branch.owner && branch.capabilities?.proposal_items;
        paragraph(card,`${proposal.author_name}: ${proposal.reason} · ${proposal.status==="pending"?`${open.length} von ${items.length} Änderungen offen`:proposal.status==="accepted"?"angenommen":proposal.status==="mixed"?"teilweise angenommen, teilweise abgelehnt":"abgelehnt"} · ${fmt(proposal.created_at)}`);
        if (proposal.decided_at) paragraph(card, `Entschieden am ${fmt(proposal.decided_at)}`);
        const conflicts = root.WochenplanProposals.conflicts(branch.payload, open);
        for (const {change: c, index, status: itemStatus} of items) {
          const row = document.createElement("section"); row.className = "sharedProposalItem"; row.dataset.itemIndex = String(index); row.dataset.status = itemStatus;
          changes(row, [c]);
          if (!c.decision) paragraph(row, itemStatus === "pending" ? "Offen" : itemStatus === "accepted" ? "Angenommen" : "Abgelehnt");
          const conflict = conflicts.includes(c);
          if (conflict) {
            paragraph(row, "Plan inzwischen geändert – bitte vergleichen. Diese Änderung kann nicht unverändert übernommen werden.").className = "sharedProposalConflict";
            const value = c.path.reduce((v, k) => v?.[k], branch.payload);
            paragraph(row, `Aktueller Plan: ${JSON.stringify(value ?? null)}`);
          }
          if (itemActions && itemStatus === "pending") {
            const actions = document.createElement("div"); actions.className = "sharedProposalActions";
            const accept = button(actions, "Änderung annehmen", async () => {
              if (confirm("Nur diese Änderung in den Filialplan übernehmen? Die übrigen Punkte bleiben unverändert.")) await controller.decideProposalItems(proposal.id, [index], "accepted");
            });
            accept.disabled = conflict || status.busy; accept.dataset.conflict = String(conflict);
            button(actions, "Änderung ablehnen", () => controller.decideProposalItems(proposal.id, [index], "rejected"));
            row.append(actions);
          }
          card.append(row);
        }
        if(branch.owner&&proposal.status==="pending") {
          if (!itemActions) paragraph(card, "Einzelentscheidungen benötigen noch die Server-Aktualisierung. Bis dahin kann der Vorschlag als Ganzes entschieden werden.");
          const accept = button(card,itemActions ? "Alle offenen annehmen" : "Vorschlag annehmen",async()=>{if(confirm("Alle noch offenen Änderungen in den Filialplan übernehmen?")) await controller.perform("decide_proposal",{id:proposal.id,decision:"accepted"});});
          accept.disabled = Boolean(conflicts.length);
          accept.dataset.conflict = String(Boolean(conflicts.length));
          button(card,itemActions ? "Alle offenen ablehnen" : "Vorschlag ablehnen",()=>controller.perform("decide_proposal",{id:proposal.id,decision:"rejected"}));
        }
        el(proposal.status === "pending" ? "sharedProposals" : "sharedResolvedProposals").append(card);
      }
      }
      el("sharedProposalSection").querySelectorAll("button").forEach(b => { b.disabled = status.busy || b.dataset.conflict === "true"; });
      markProposalCells();
      clear("sharedPublications");
      for(const pub of branch.publications) paragraph(el("sharedPublications"),`Woche ${pub.week_start} · ${pub.actor_name} · ${fmt(pub.published_at)} · ${pub.changed?"Seit Freigabe geändert":"Entspricht dem freigegebenen Stand"}`);
    }
    async function run(work) {
      message("");
      try { await work(); } catch(error) { message(error.message); }
      finally { render(controller.status); }
    }
    controller=root.WochenplanCollaboration.create({ ...options, projectRef:options.config.projectRef,storage:localStorage,
      onChange:render,onContextChange:()=>{root.WochenplanPlanning?.invalidateUndo();options.cloud.resetLink();events=[];pageBefore=null;preview=null;el("sharedCompare").classList.add("hidden");el("sharedEvents").replaceChildren();} });
    const on=(id,work)=>el(id).addEventListener("click",()=>run(work));
    el("sharedBranchSelect").addEventListener("change",()=>run(async()=>{
      if(!confirm("Filiale wechseln? Dein Geräte-Stand bleibt erhalten. Offene Änderungen vorher als Datei sichern.")) {render(controller.status);return;}
      await controller.select(el("sharedBranchSelect").value);
    }));
    on("btnSharedCreate",async()=>{
      if(!el("sharedBranchName").value.trim()||!el("sharedDisplayName").value.trim()) throw Error("Bitte Filialname und deinen Anzeigenamen eingeben.");
      if(confirm("Diesen Geräte-Stand als gemeinsamen Filialplan anlegen? Eine vorherige Dateisicherung wird empfohlen.")) await controller.create(el("sharedBranchName").value.trim(),el("sharedDisplayName").value.trim());
    });
    on("btnSharedJoin",async()=>{
      let token=el("sharedInviteToken").value.trim();
      if(token.includes("#wp-invite=")) token=new URLSearchParams(token.split("#")[1]).get("wp-invite");
      if(!token||!el("sharedDisplayName").value.trim()) throw Error("Bitte Einladung und deinen Anzeigenamen eingeben.");
      await controller.join(token,el("sharedDisplayName").value.trim());el("sharedInviteToken").value="";sessionStorage.removeItem("wochenplan_pending_invite");
    });
    on("btnSharedRefresh",()=>controller.refresh());
    el("btnSharedProposalOverview").addEventListener("click", () => {
      el("btnDataPanel").click(); el("sharedProposalSection").open = true;
      el("sharedProposalSection").scrollIntoView({ block: "start" });
    });
    on("btnSharedSave",async()=>{
      if(!saveAppState()) throw Error("Bitte zuerst die lokale Sicherung prüfen.");
      preview=await controller.compare();clear("sharedCompareChanges");changes(el("sharedCompareChanges"),preview.changes);
      el("sharedCompare").classList.remove("hidden");
      if(!preview.changes.length) paragraph(el("sharedCompareChanges"),"Gerät und Filialplan stimmen überein.");
    });
    on("btnSharedConfirmSave",async()=>{if(preview&&confirm("Die angezeigten Änderungen übernehmen?")){await controller.save(el("sharedReason").value,true,preview);preview=null;el("sharedCompare").classList.add("hidden");}});
    on("btnSharedAdopt",async()=>{if(confirm("Aktuellen Filialplan übernehmen? Sichere deinen offenen Entwurf vorher als Datei. Der vorherige lokale Stand bleibt wiederherstellbar.")) await controller.adopt();});
    on("btnSharedPropose",async()=>{if(!el("sharedReason").value.trim()) throw Error("Bitte einen Grund für deinen Vorschlag angeben.");if(!saveAppState()) throw Error("Bitte zuerst die lokale Sicherung prüfen.");await controller.propose(el("sharedReason").value.trim());el("sharedReason").value="";message("Vorschlag eingereicht und separat gespeichert. Der gemeinsame Plan bleibt bis zur Annahme unverändert.");});
    on("btnSharedInvite",async()=>{const invite=await controller.perform("invite");const url=new URL(location.href);url.hash="wp-invite="+invite.token;el("sharedInviteLink").value=url.href;el("sharedInviteLink").select();message("Link erstellt. Kopiere ihn und gib ihn persönlich an deine Vertretung weiter.");});
    on("btnSharedGrant",()=>controller.perform("grant",{user_id:el("sharedMember").value,starts_at:berlinBoundary(el("sharedGrantFrom").value),ends_at:berlinBoundary(el("sharedGrantTo").value,true),can_publish:el("sharedCanPublish").checked}));
    on("btnSharedRemoveMember",async()=>{if(confirm("Zugang dieser Person und ihre aktiven Vertretungsrechte beenden?")) await controller.perform("remove_member",{user_id:el("sharedMember").value});});
    on("btnSharedPublish",async()=>{if(confirm("Den aktuellen Online-Stand dieser Woche als verbindlich kennzeichnen? Noch offene lokale Änderungen werden dabei nicht übernommen.")) await controller.perform("publish",{week_start:el("sharedPublishWeek").value});});
    on("btnSharedCheckpoint",()=>controller.perform("checkpoint",{label:el("sharedCheckpointName").value}));
    on("btnSharedSnapshotExport",async()=>{const snap=await controller.perform("snapshot",{id:el("sharedSnapshotSelect").value});triggerBackupDownload(snap.payload,`wochenplan-filialstand-${snap.revision}.json`);});
    on("btnSharedRestore",async()=>{if(confirm("Den Filialplan durch den gewählten Sicherungsstand ersetzen? Der aktuelle Stand bleibt als Rückweg erhalten.")) await controller.perform("restore",{id:el("sharedSnapshotSelect").value});});
    on("btnSharedArchive",async()=>{triggerBackupDownload(await controller.archive(),`wochenplan-filialarchiv-${new Date().toISOString().slice(0,10)}.json`);message("Archiv heruntergeladen. Bitte zusätzlich außerhalb dieses Gerätes aufbewahren.");});
    async function loadHistory(older=false) {
      if(!controller.status.selected) return;
      const key=`wochenplan_visit:${options.config.projectRef}:${controller.status.user.id}:${controller.status.selected}`;
      if(!older) {visitAfter=Number(localStorage.getItem(key)||0);events=[];pageBefore=null;}
      const page=await controller.history(older?{before_id:pageBefore}:{});
      events.push(...page);pageBefore=page.at(-1)?.id;
      if(!older&&page.length) localStorage.setItem(key,String(page[0].id));
      el("btnSharedHistoryOlder").classList.toggle("hidden",page.length<100);renderEvents();
    }
    on("btnSharedHistory",()=>loadHistory());on("btnSharedHistoryOlder",()=>loadHistory(true));
    for(const id of ["sharedActorFilter","sharedHistoryWeek","sharedSinceVisit"]) el(id).addEventListener("change",renderEvents);
    const token=new URLSearchParams(location.hash.slice(1)).get("wp-invite");
    if(token) {sessionStorage.setItem("wochenplan_pending_invite",token);history.replaceState(null,"",location.pathname+location.search);}
    el("sharedInviteToken").value=sessionStorage.getItem("wochenplan_pending_invite")||"";
    if(el("sharedInviteToken").value) {el("sharedSetup").open=true;message("Einladung erkannt. Bitte zuerst anmelden und danach deinen Anzeigenamen eingeben.");}
    el("sharedPublishWeek").value=state.weekFrom||"";
    render(controller.status);
    const observer = new MutationObserver(markProposalCells);
    if (el("grid")) observer.observe(el("grid"), { childList: true, subtree: true });
    if (el("monthView")) observer.observe(el("monthView"), { childList: true, subtree: true });
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("online", queueRefresh);
    window.addEventListener("offline", pauseRefresh);
    window.addEventListener("pagehide", pauseRefresh);
    const dispose = controller.dispose;
    controller.dispose = () => { disposed = true; pauseRefresh(); observer.disconnect(); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("online", queueRefresh); window.removeEventListener("offline", pauseRefresh); window.removeEventListener("pagehide", pauseRefresh); dispose(); };
    controller.refreshView=()=>render(controller.status);
    return controller;
  }
  root.WochenplanCollaborationPanel=Object.freeze({mount,berlinBoundary});
})(typeof window === "undefined" ? globalThis : window);
