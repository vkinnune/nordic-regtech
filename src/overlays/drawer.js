/* =====================================================================
   OVERLAYS: drawer, modals, popovers, context menus, command palette
   ===================================================================== */
import { MOD, TODAY, ago, diffD, esc, fmtDate, parse, relDate } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { D, S, commentsOf, isOver, mem, pColor, proj, task, policy, control, risk, regulationOfSection } from '../core/store.js';
import { FT, av, diffBadge, diffTokenHtml, filePrev, fileType, fmtComment, lbl, progBar, formatSecBadge } from '../ui/helpers.js';
import { fxc } from '../shell/render.js';
import { cellAssignee, cellDue, cellPrio, cellProject, cellStatus } from '../components/task-list.js';
import { modalHtml } from './modals.js';
import { popHtml } from './popovers.js';
import { paletteHtml } from './palette.js';
import { subtaskHtml } from '../features/subtasks.js';

export function renderLayer() {
  const u = S.ui;
  let h = '';
  if (u.drawer && task(u.drawer))
    h += (u.drawerFull ? `<div class="drawer-scrim full${u.fx.drawer ? ' enter' : ''}" data-a="closeDrawer"></div>` : '') + drawerHtml(task(u.drawer));
  if (u.govDrawer)
    h += (u.drawerFull ? `<div class="drawer-scrim full${u.fx.drawer ? ' enter' : ''}" data-a="closeGovDrawer"></div>` : '') + govDrawerHtml(u.govDrawer);
  u.modals.forEach((m, i) => {
    const en = u.fx.modal === i + 1;
    h += `<div class="scrim${en ? ' enter' : ''}" data-a="closeModal" style="z-index:${60 + i * 2}"></div><div class="modal-wrap" data-a="closeModalBg" style="z-index:${61 + i * 2}">${en ? modalHtml(m).replace('class="modal ', 'class="modal enter ') : modalHtml(m)}</div>`;
  });
  if (u.palette) h += `<div class="scrim" data-a="closePalette" style="z-index:89"></div>${paletteHtml()}`;
  if (u.pop) h += popHtml(u.pop);
  return h;
}

/* ---------------- TASK DRAWER ---------------- */
export function drawerHtml(t) {
  const p = proj(t.project);
  const u = S.ui;
  const cs = commentsOf(t.id);
  const sd = t.subtasks.filter(s => s.done).length;
  const acts = D().activity.filter(a => a.task === t.id);
  const tab = u.drawerTab;
  const prop = (icon, label, val) => `<dt>${ic(icon, 14)}${label}</dt><dd>${val}</dd>`;
  const ups = (u.uploads || []).filter(x => x.task === t.id);
  const ment =
    u.mention && u.mention.tid === t.id
      ? D()
          .members.filter(
            m => m.name.toLowerCase().startsWith(u.mention.q.toLowerCase()) || m.name.split(' ')[1]?.toLowerCase().startsWith(u.mention.q.toLowerCase()),
          )
          .slice(0, 5)
      : [];
  const sub = u.subOpen && u.subOpen.tid === t.id ? t.subtasks.find(s => s.id === u.subOpen.sid) : null;
  return `<aside class="drawer ${u.drawerFull ? 'full' : ''} ${u.fx.drawer ? 'enter' : ''} ${u.fx.tabs ? 'fx-tabs' : ''}" role="dialog" aria-modal="${u.drawerFull}" aria-labelledby="d-h" tabindex="-1">
    <h2 class="sr" id="d-h">${sub ? 'Subtask: ' + esc(sub.title) : 'Task: ' + esc(t.title)}</h2>
    <div class="drawer-h">
      <button class="pillbtn" data-a="go" data-r="project" data-id="${p.id}" data-tab="board" style="font-size:12.5px"><span class="pdot" style="--c:${pColor(p)}"></span>${esc(p.name)}</button><span class="faint">/</span><span class="mono faint" style="font-size:11.5px;padding:0 6px">${t.key}</span>
      <span class="sp"></span>
      <button class="btn btn-sm ${t.status === 'done' ? 'btn-secondary' : 'btn-ghost'}" data-a="toggleDone" data-id="${t.id}" style="${t.status === 'done' ? 'color:var(--green)' : ''}">${ic(t.status === 'done' ? 'circle-check' : 'circle', 14)}<span class="hide-m">${t.status === 'done' ? 'Completed' : 'Mark complete'}</span></button>
      <button class="ibtn ibtn-sm" data-a="toggleFavTask" data-id="${t.id}" data-tip="${t.fav ? 'Unfavorite' : 'Favorite'}" aria-pressed="${t.fav}" aria-label="Favorite" style="${t.fav ? 'color:var(--amber)' : ''}">${ic('star', 15)}</button>
      <button class="ibtn ibtn-sm" data-a="copyLink" data-id="${t.id}" data-tip="Copy link" aria-label="Copy link">${ic('link', 15)}</button>
      <button class="ibtn ibtn-sm hide-m" data-a="toggleDrawerFull" data-tip="${u.drawerFull ? 'Side panel' : 'Full page'}" aria-label="Toggle full page">${ic(u.drawerFull ? 'minimize-2' : 'maximize-2', 15)}</button>
      <button class="ibtn ibtn-sm" data-a="ctxBtn" data-ctx="task" data-id="${t.id}" aria-label="More">${ic('ellipsis', 15)}</button>
      <button class="ibtn ibtn-sm" data-a="closeDrawer" data-tip="Close  Esc" aria-label="Close">${ic('x', 16)}</button>
    </div>
    <div class="drawer-b" data-keep="drawer:${t.id}${sub ? ':' + sub.id : ''}">${
      sub
        ? subtaskHtml(t, sub)
        : `
      ${t.status === 'done' ? `<div class="alert ok" style="margin-bottom:12px">${ic('circle-check', 15)}<span>Completed ${t.completedAt ? ago(t.completedAt) : ''}. <button class="link" data-a="toggleDone" data-id="${t.id}">Reopen task</button></span></div>` : isOver(t) ? `<div class="alert danger" style="margin-bottom:12px">${ic('clock-alert', 15)}<span>Overdue by ${-diffD(parse(t.due), TODAY)} day${-diffD(parse(t.due), TODAY) > 1 ? 's' : ''}. <button class="link" data-a="pop" data-pop="date" data-field="due" data-id="${t.id}">Reschedule</button></span></div>` : ''}
      <textarea class="ttl-edit" id="d-title" rows="1" data-autosize data-blur="commitDrawerTitle" data-key-enter="blur" data-id="${t.id}" aria-label="Task title">${esc(t.title)}</textarea>
      <dl class="kv" style="margin-top:12px;${u.drawerFull ? 'grid-template-columns:112px minmax(0,1fr) 112px minmax(0,1fr)' : ''}">
        ${prop('circle-dot', 'Status', cellStatus(t))}
        ${prop('signal-high', 'Priority', cellPrio(t))}
        ${prop('user', 'Assignee', cellAssignee(t))}
        ${prop('calendar', 'Due date', cellDue(t))}
        ${prop('calendar-arrow-up', 'Start date', `<button class="pillbtn ${t.start ? '' : 'empty'}" data-a="pop" data-pop="date" data-field="start" data-id="${t.id}">${ic('calendar', 13)}${t.start ? fmtDate(t.start) : 'Set date'}</button>`)}
        ${prop('folder', 'Project', cellProject(t))}
        ${prop('tag', 'Labels', `<button class="pillbtn ${t.labels.length ? '' : 'empty'}" data-a="pop" data-pop="labels" data-id="${t.id}" style="flex-wrap:wrap;height:auto;min-height:26px;padding:3px 7px">${t.labels.length ? t.labels.map(lbl).join('') : ic('tag', 13) + 'Add labels'}</button>`)}
        ${prop('repeat', 'Repeat', `<button class="pillbtn ${t.recur ? '' : 'empty'}" data-a="pop" data-pop="recur" data-id="${t.id}">${ic('repeat', 13)}${t.recur || 'Does not repeat'}</button>`)}
        ${prop('clock', 'Estimate', `<button class="pillbtn ${t.estimate ? '' : 'empty'}" data-a="pop" data-pop="estimate" data-id="${t.id}">${ic('clock', 13)}${t.estimate ? esc(t.estimate) : 'Set estimate'}</button>`)}
        ${prop('git-branch', 'Dependencies', `<button class="pillbtn ${t.deps.length ? '' : 'empty'}" data-a="pop" data-pop="deps" data-id="${t.id}" style="height:auto;min-height:26px;flex-wrap:wrap">${t.deps.length ? t.deps.map(d => (task(d) ? `<span class="depchip mono" style="font-size:11px;padding:1px 5px;border-radius:4px;background:var(--surface-3)">${task(d).key}</span><span class="trunc" style="max-width:160px">${esc(task(d).title)}</span>` : '')).join('') : ic('git-branch', 13) + 'None'}</button>`)}
      </dl>

      ${t.diff ? diffViewerHtml(t.diff) : ''}

      <div class="dsec"><div class="dsec-h"><h3 id="d-desc-l">Description</h3><div class="rte-tb" role="toolbar" aria-label="Formatting" aria-controls="d-desc">
          ${[
            ['bold', 'bold', 'Bold'],
            ['italic', 'italic', 'Italic'],
            ['insertUnorderedList', 'list', 'Bulleted list'],
            ['insertOrderedList', 'list-ordered', 'Numbered list'],
            ['formatBlock:h4', 'heading', 'Heading'],
            ['createLink', 'link', 'Link'],
          ]
            .map(([c, i, n]) => `<button class="ibtn ibtn-xs" data-cmd="${c}" data-tip="${n}" aria-label="${n}">${ic(i, 13)}</button>`)
            .join('')}
        </div></div>
        <div class="rte"><div class="rte-body" id="d-desc" contenteditable="true" data-rte="${t.id}" data-ph="Add a description…" role="textbox" aria-multiline="true" aria-labelledby="d-desc-l">${t.desc}</div></div>
      </div>

      <div class="dsec"><div class="dsec-h"><h3>Subtasks</h3><span class="cnt num">${sd}/${t.subtasks.length}</span>${t.subtasks.length ? `<span style="width:90px;display:flex">${progBar(Math.round((sd / t.subtasks.length) * 100), sd === t.subtasks.length ? 'green' : '')}</span>` : ''}</div>
        ${t.subtasks.map(s => `<div class="subt ${s.done ? 'done' : ''}${fxc('added', s.id)}${fxc('done', s.id)}"><input type="checkbox" class="check" ${s.done ? 'checked' : ''} data-a="toggleSub" data-id="${t.id}" data-sid="${s.id}" aria-label="${s.done ? 'Reopen' : 'Complete'} subtask ${esc(s.title)}"><button class="s" data-a="openSub" data-id="${t.id}" data-sid="${s.id}">${esc(s.title)}</button>${s.due ? `<span class="due ${!s.done && diffD(parse(s.due), TODAY) < 0 ? 'over' : ''}">${ic('calendar', 12)}${relDate(s.due)}</span>` : ''}${s.assignee ? av(s.assignee, 'sm') : ''}<button class="ibtn ibtn-xs x" data-a="openSub" data-id="${t.id}" data-sid="${s.id}" aria-label="Open subtask details" tabindex="-1">${ic('chevron-right', 14)}</button></div>`).join('')}
        <div class="subt" style="color:var(--text-3)">${ic('plus', 15)}<input class="inline-in" id="d-sub" data-key-enter="addSub" data-id="${t.id}" placeholder="Add subtask" aria-label="Add subtask" style="font-size:13.5px"></div>
      </div>

      <div class="dsec"><div class="dsec-h"><h3>Attachments</h3><span class="cnt">${t.attachments.length}</span><div class="acts"><label class="btn btn-sm btn-ghost" style="cursor:pointer">${ic('upload', 13)}Upload<input type="file" multiple hidden data-in="uploadFiles" data-task="${t.id}" data-project="${t.project}"></label></div></div>
        ${ups.map(x => `<div class="upl" style="margin-bottom:6px"><span class="ftype" style="--c:${FT[fileType(x.name)].c}">${ic(FT[fileType(x.name)].i, 14)}</span><div class="grow"><div class="row"><span class="trunc">${esc(x.name)}</span><span class="sp"></span><span class="faint num" id="upct-${x.id}" style="font-size:11px">${x.pct}%</span></div><div class="prog" style="margin-top:5px"><i id="upbar-${x.id}" style="width:${x.pct}%"></i></div></div></div>`).join('')}
        ${t.attachments.length ? `<div class="att">${t.attachments.map(f => `<div class="attc" data-a="filePreview" data-tid="${t.id}" data-aid="${f.id}" role="button" tabindex="0">${filePrev(f)}<div class="fi"><div class="trunc" style="font-weight:500">${esc(f.name)}</div><div class="faint">${FT[f.type]?.n || 'File'} · ${f.size}</div></div><button class="ibtn ibtn-xs x" data-a="rmAttach" data-id="${t.id}" data-aid="${f.id}" aria-label="Remove attachment">${ic('x', 12)}</button></div>`).join('')}</div>` : !ups.length ? `<label class="dropzone" style="padding:12px" data-dropzone-task="${t.id}">${ic('paperclip', 15)}<span>Drop files or click to attach</span><input type="file" multiple hidden data-in="uploadFiles" data-task="${t.id}" data-project="${t.project}"></label>` : ''}
      </div>

      <div class="dsec">
        <div class="tabs" style="margin-bottom:6px">${[
          ['comments', `Comments`, cs.length],
          ['activity', 'Activity', acts.length],
        ]
          .map(
            ([k, n, c]) =>
              `<button class="tab ${tab === k ? 'on' : ''}" data-a="set" data-k="drawerTab" data-v="${k}">${n}<span class="cnt">${c}</span></button>`,
          )
          .join('')}</div>
        ${
          tab === 'comments'
            ? `
          ${cs.length ? cs.map(commentHtml).join('') : `<p class="faint" style="font-size:13px;margin:10px 0">No comments yet. Start the conversation.</p>`}
          <div class="row" style="align-items:flex-start;gap:10px;margin-top:8px">${av(D().me, 'md', false)}<div class="grow" style="position:relative">
            <div class="cbox"><textarea id="d-cmt" data-in="draft" data-id="${t.id}" data-key-mod-enter="postComment" placeholder="Leave a comment… type @ to mention" aria-label="Comment" rows="2" data-autosize>${esc(u.drafts[t.id] || '')}</textarea>
            <div class="row"><button class="ibtn ibtn-xs" data-a="insertAt" data-id="${t.id}" data-tip="Mention someone" aria-label="Mention">${ic('at-sign', 14)}</button><label class="ibtn ibtn-xs" data-tip="Attach file" style="cursor:pointer">${ic('paperclip', 14)}<input type="file" multiple hidden data-in="uploadFiles" data-task="${t.id}" data-project="${t.project}"></label><span class="sp"></span><span class="faint hide-m" style="font-size:11px">${MOD}+Enter</span><button class="btn btn-primary btn-sm" data-a="postComment" data-id="${t.id}">Comment</button></div></div>
            ${ment.length ? `<div class="pop" style="position:absolute;top:auto;bottom:calc(100% + 4px);left:0">${ment.map(m => `<button class="mi" data-a="pickMention" data-id="${t.id}" data-name="${esc(m.name)}">${av(m.id, 'sm', false)}${esc(m.name)}<span class="r">${esc(m.title)}</span></button>`).join('')}</div>` : ''}
          </div></div>`
            : `
          <div style="padding-top:4px">${acts.map(a => `<div class="act-line"><span class="ico">${av(a.by, 'sm', false)}</span><span class="grow"><b>${esc(mem(a.by)?.id === D().me ? 'You' : mem(a.by)?.name)}</b> ${esc(a.verb.replace(/ of$/, ''))}${a.extra ? ' ' + esc(a.extra) : ''}</span><time class="faint" style="font-size:11.5px">${ago(a.at)}</time></div>`).join('')}
          <div class="act-line"><span class="ico">${ic('plus', 13)}</span><span class="grow">Task created</span><time class="faint" style="font-size:11.5px">${ago(t.created)}</time></div></div>`
        }
      </div>`
    }
    </div>
  </aside>`;
}
export function commentHtml(c) {
  const m = mem(c.by);
  const mine = c.by === D().me;
  return `<div class="cmt">${av(c.by, 'md', false)}<div class="body"><div class="who"><b>${esc(m?.name)}</b><time>${ago(c.at)}</time>${mine ? `<span class="sp"></span><button class="ibtn ibtn-xs" data-a="delComment" data-id="${c.id}" aria-label="Delete comment" data-tip="Delete">${ic('trash-2', 12)}</button>` : ''}</div><div class="txt">${fmtComment(c.text)}</div>
    <div class="reacts">${Object.entries(c.re || {})
      .filter(([, v]) => v.length)
      .map(
        ([e, v]) =>
          `<button class="react ${v.includes(D().me) ? 'mine' : ''}" data-a="react" data-id="${c.id}" data-e="${e}" aria-label="${e} ${v.length}" title="${v.map(i => mem(i)?.name).join(', ')}">${e}<span class="num">${v.length}</span></button>`,
      )
      .join(
        '',
      )}<button class="react" data-a="pop" data-pop="emoji" data-id="${c.id}" aria-label="Add reaction" style="color:var(--text-3)">${ic('smile-plus', 13)}</button></div></div></div>`;
}

export function diffViewerHtml(diff) {
  if (!diff) return '';
  const isPlain = S.ui.diffPlain !== false;

  return `<div class="dsec diff-sec">
    <div class="dsec-h" style="align-items:center;gap:8px">
      <h3 style="display:flex;align-items:center;gap:6px">${ic('scale', 14)}Law change</h3>
      ${diffBadge(diff)}
      <span class="sp"></span>
      <div class="seg" role="tablist" style="font-size:11px">
        <button class="${isPlain ? 'on' : ''}" data-a="toggleDiffPlain">${ic('sparkles', 11)}In plain English</button>
        <button class="${!isPlain ? 'on' : ''}" data-a="toggleDiffPlain">Original text</button>
      </div>
    </div>

    ${
      isPlain
        ? `<div class="diff-box" style="padding:14px;background:var(--surface-2)">
            <div style="font-size:10.5px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--text-3);margin-bottom:4px">
              What this law means in simple words:
            </div>
            <div style="font-size:13.5px;line-height:1.55;font-weight:600;color:var(--text);margin-bottom:8px">
              ${esc(diff.plainEnglish?.summary || diff.heading)}
            </div>
            ${
              diff.plainEnglish?.points && diff.plainEnglish.points.length
                ? `<div style="font-size:11.5px;font-weight:600;color:var(--text-2);margin-bottom:4px">Key requirements:</div>
                   <ul style="margin:0 0 10px;padding-left:18px;font-size:12.5px;line-height:1.55;color:var(--text-2)">
                     ${diff.plainEnglish.points.map(pt => `<li>${esc(pt)}</li>`).join('')}
                   </ul>`
                : ''
            }
            ${
              diff.plainEnglish?.beforeAfter
                ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;font-size:12px">
                    <div style="background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:8px 10px">
                      <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:3px">
                        Before (Previous law):
                      </div>
                      <div style="color:var(--text-2);line-height:1.45">
                        ${esc(diff.plainEnglish.beforeAfter.before)}
                      </div>
                    </div>
                    <div style="background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--text);border-radius:4px;padding:8px 10px">
                      <div style="font-size:10px;font-weight:700;color:var(--text);text-transform:uppercase;margin-bottom:3px">
                        After (${esc(diff.amendingAct || 'New law')}):
                      </div>
                      <div style="color:var(--text);font-weight:500;line-height:1.45">
                        ${esc(diff.plainEnglish.beforeAfter.after)}
                      </div>
                    </div>
                  </div>`
                : ''
            }
            ${
              diff.plainEnglish?.translation
                ? `<div style="border-top:1px solid var(--border);padding-top:8px;margin-top:6px">
                     <div style="font-size:11px;font-weight:600;color:var(--text-3);margin-bottom:4px">English translation of statutory text:</div>
                     <div style="font-size:12.5px;line-height:1.6;color:var(--text);background:var(--surface);padding:8px 10px;border-radius:4px;border:1px solid var(--border)">
                       ${esc(diff.plainEnglish.translation)}
                     </div>
                   </div>`
                : ''
            }
            <div style="display:flex;align-items:center;gap:12px;margin-top:10px;font-size:11.5px;color:var(--text-3)">
              <span>In force: <b>${esc(diff.inForce || 'Pending')}</b></span>
              <span>·</span>
              <span>Authority: <b>${esc(diff.authority || 'Finansinspektionen')}</b></span>
            </div>
          </div>`
        : `<div class="diff-box">
            <div class="diff-head">
              <span class="diff-ident mono" style="font-weight:700">${esc(diff.identifier)}</span>
              <span class="faint">·</span>
              <span class="diff-title trunc">${esc(diff.heading)}</span>
              <span class="sp"></span>
              <span class="mono faint" style="font-size:11px">${esc(diff.amendingAct || '')}</span>
            </div>
            <div class="diff-body">${(diff.tokens || []).map(diffTokenHtml).join('')}</div>
            <div class="diff-foot">
              <span class="row" style="gap:4px">${ic('calendar', 12)}<span>In force: <b>${esc(diff.inForce || 'Pending')}</b></span></span>
              <span class="sp"></span>
              <span class="row" style="gap:4px">${ic('landmark', 12)}<span>Authority: <b>${esc(diff.authority || 'Finansinspektionen')}</b></span></span>
            </div>
          </div>`
    }
  </div>`;
}

/* ---------------- GOVERNANCE DRAWER (Policies, Controls, Risks) ---------------- */
export function govDrawerHtml(gov) {
  const { type, id } = gov;
  const u = S.ui;
  let item = null;
  if (type === 'policy') item = policy(id);
  else if (type === 'control') item = control(id);
  else if (type === 'risk') item = risk(id);

  if (!item) return '';

  const typeName = type === 'policy' ? 'Käytäntö' : type === 'control' ? 'Kontrolli' : 'Säädösriski';
  const typeIcon = type === 'policy' ? 'file-text' : type === 'control' ? 'shield-check' : 'alert-triangle';

  return `<aside class="drawer ${u.drawerFull ? 'full' : ''} ${u.fx.drawer ? 'enter' : ''}" role="dialog" aria-modal="${u.drawerFull}" aria-labelledby="gov-d-h" tabindex="-1">
    <div class="drawer-h">
      <span class="pill mono" style="font-size:11.5px;padding:2px 6px">${ic(typeIcon, 12)} ${esc(typeName)}: ${esc(item.code)}</span>
      <span class="sp"></span>
      <button class="ibtn ibtn-sm hide-m" data-a="toggleDrawerFull" data-tip="${u.drawerFull ? 'Side panel' : 'Full page'}" aria-label="Toggle full page">${ic(u.drawerFull ? 'minimize-2' : 'maximize-2', 15)}</button>
      <button class="ibtn ibtn-sm" data-a="closeGovDrawer" data-tip="Sulje  Esc" aria-label="Sulje">${ic('x', 16)}</button>
    </div>

    <div class="drawer-b">
      <h2 id="gov-d-h" style="font-size:18px;font-weight:700;color:var(--text);margin:0 0 12px;line-height:1.35">${esc(item.title)}</h2>

      ${
        type === 'control' && item.impactedByAmendment
          ? `<div class="alert danger" style="margin-bottom:16px">
              ${ic('alert-triangle', 15)}
              <div style="flex:1">
                <div style="font-weight:700;font-size:12.5px">Lakimuutosvaikutus: ${esc(item.impactedByAmendment)}</div>
                <div style="font-size:12px;margin-top:2px">${esc(item.amendmentAlert || '')}</div>
                <div style="margin-top:8px;display:flex;gap:8px">
                  ${
                    item.status === 'DEFICIENT'
                      ? `<button class="btn btn-sm btn-primary" data-a="resolveGap" data-id="${item.id}" style="font-size:11.5px;padding:3px 8px">${ic('check-circle', 12)} Merkitse toimivaksi</button>`
                      : `<span class="pill mono" style="font-size:11px">${ic('check', 11)} Kuitattu toimivaksi</span>`
                  }
                  <button class="btn btn-sm btn-ghost" data-a="createMitigationTask" data-ctl="${item.id}" style="font-size:11.5px;padding:3px 8px">${ic('plus', 12)} Luo päivitystehtävä</button>
                </div>
              </div>
            </div>`
          : ''
      }

      <div class="dsec">
        <div class="dsec-h"><h3>Kuvaus ja määrittely</h3></div>
        <p style="font-size:13px;line-height:1.55;color:var(--text);margin:0">${esc(item.summary || item.specification || item.consequence || '')}</p>
      </div>

      <dl class="kv" style="margin-top:16px">
        ${item.owner ? `<dt>${ic('user', 14)}Vastuu</dt><dd>${esc(item.owner)} ${item.ownerRole ? `<span class="muted" style="font-size:11px">(${esc(item.ownerRole)})</span>` : ''}</dd>` : ''}
        ${item.status ? `<dt>${ic('shield', 14)}Tila</dt><dd><span class="mono" style="font-size:12px;font-weight:600">${esc(item.status)}</span></dd>` : ''}
        ${item.severity ? `<dt>${ic('alert-octagon', 14)}Vakavuus</dt><dd><span class="mono" style="font-size:12px;font-weight:600">${esc(item.severity)} (Altistus: ${item.exposureScore}/100)</span></dd>` : ''}
        ${item.authority ? `<dt>${ic('landmark', 14)}Valvoja</dt><dd>${esc(item.authority)}</dd>` : ''}
        ${item.frequency ? `<dt>${ic('clock', 14)}Tiheys</dt><dd>${esc(item.frequency)}</dd>` : ''}
        ${item.version ? `<dt>${ic('file-text', 14)}Versio</dt><dd>v${esc(item.version)} (Tarkistettu: ${esc(item.lastReviewDate)})</dd>` : ''}
      </dl>

      <!-- Linked Statutory Sections -->
      ${
        item.statuteSections && item.statuteSections.length
          ? `<div class="dsec" style="margin-top:20px">
              <div class="dsec-h"><h3>Liitetyt säädökset ja pykälät</h3></div>
              <div class="col" style="gap:6px">
                ${item.statuteSections
                  .map(secId => {
                    const label = formatSecBadge(secId);
                    const reg = regulationOfSection(secId);
                    const regId = reg ? reg.id : 'reg-finlex-747-2012';
                    return `<div class="row" style="justify-content:space-between;padding:8px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px">
                      <span class="mono" style="font-size:12.5px;font-weight:600">${esc(label)}</span>
                      <button class="btn btn-sm btn-ghost" data-a="openRegInReader" data-id="${regId}" data-sec="${secId}" style="padding:2px 7px;font-size:11.5px">
                        ${ic('book-open', 12)} Avaa Finlex-lukijassa ➔
                      </button>
                    </div>`;
                  })
                  .join('')}
              </div>
            </div>`
          : ''
      }

      <!-- Linked Tasks -->
      ${
        item.taskId && task(item.taskId)
          ? `<div class="dsec" style="margin-top:20px">
              <div class="dsec-h"><h3>Liitetty compliance-tehtävä</h3></div>
              <div class="row" style="justify-content:space-between;padding:8px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px">
                <div>
                  <div style="font-weight:700;font-size:12.5px">${task(item.taskId).key}: ${esc(task(item.taskId).title)}</div>
                  <div class="muted" style="font-size:11px">Tila: ${esc(task(item.taskId).status)} · Määräaika: ${esc(task(item.taskId).due || 'Ei asetettu')}</div>
                </div>
                <button class="btn btn-sm btn-primary" data-a="openTask" data-id="${item.taskId}" style="padding:2px 7px;font-size:11.5px">
                  ${ic('arrow-right', 12)} Avaa tehtävä
                </button>
              </div>
            </div>`
          : ''
      }
    </div>
  </aside>`;
}
