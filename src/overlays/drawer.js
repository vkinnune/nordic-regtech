/* =====================================================================
   OVERLAYS: drawer, modals, popovers, context menus, command palette
   ===================================================================== */
import { MOD, TODAY, ago, diffD, esc, fmtDate, parse, relDate } from '../core/utils.js';
import { ic } from '../core/icons.js';
import {
  D,
  S,
  commentsOf,
  isOver,
  mem,
  pColor,
  proj,
  task,
  policy,
  control,
  risk,
  allControls,
  allPolicies,
  riskGapStatus,
  riskControls,
  riskExposureScore,
  regulationOfSection,
  feedItem,
} from '../core/store.js';
import {
  FT,
  av,
  diffBadge,
  diffTokenHtml,
  filePrev,
  fileType,
  fmtComment,
  lbl,
  progBar,
  formatSecBadge,
  feedScoreClass,
  feedScoreLabel,
  getFeedCat,
  getFeedAuth,
} from '../ui/helpers.js';

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
  if (u.feedDrawer)
    h += (u.drawerFull ? `<div class="drawer-scrim full${u.fx.drawer ? ' enter' : ''}" data-a="closeFeedDrawer"></div>` : '') + feedDrawerHtml(u.feedDrawer);
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
        ${allControls().find(c => c.taskId === t.id) ? prop('shield', 'Control', `<button class="pillbtn" data-a="openGovDrawer" data-type="control" data-id="${allControls().find(c => c.taskId === t.id).id}" style="height:auto;padding:3px 7px">${ic('shield-check', 13)}<span class="mono">${allControls().find(c => c.taskId === t.id).code}</span> · ${esc(allControls().find(c => c.taskId === t.id).title)}</button>`) : ''}
        ${allPolicies().find(p => p.taskId === t.id) ? prop('file-text', 'Policy', `<button class="pillbtn" data-a="openGovDrawer" data-type="policy" data-id="${allPolicies().find(p => p.taskId === t.id).id}" style="height:auto;padding:3px 7px">${ic('file-text', 13)}<span class="mono">${allPolicies().find(p => p.taskId === t.id).code}</span> · ${esc(allPolicies().find(p => p.taskId === t.id).title)}</button>`) : ''}
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
const GOV_TYPE_META = {
  policy: { name: 'Policy', icon: 'file-text' },
  control: { name: 'Control', icon: 'shield-check' },
  risk: { name: 'Regulatory Risk', icon: 'alert-triangle' },
};

function renderControlRow(c) {
  return `<div class="row" style="justify-content:space-between;padding:8px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px">
    <div>
      <span class="mono" style="font-weight:700;font-size:12px">${esc(c.code)}</span>
      <span style="font-size:12px;margin-left:6px">${esc(c.title)}</span>
      <span class="pill mono" style="font-size:10px;margin-left:6px">${esc(c.status)}</span>
    </div>
    <button class="btn btn-sm btn-ghost" data-a="openGovDrawer" data-type="control" data-id="${c.id}" style="padding:2px 7px;font-size:11.5px">
      ${ic('shield-check', 12)} Open control ➔
    </button>
  </div>`;
}

export function govDrawerHtml(gov) {
  const { type, id } = gov;
  const u = S.ui;
  let item = null;
  if (type === 'policy') item = policy(id);
  else if (type === 'control') item = control(id);
  else if (type === 'risk') item = risk(id);

  if (!item) return '';

  const meta = GOV_TYPE_META[type] || { name: 'Governance Entity', icon: 'shield' };
  const typeName = meta.name;
  const typeIcon = meta.icon;

  return `<aside class="drawer ${u.drawerFull ? 'full' : ''} ${u.fx.drawer ? 'enter' : ''}" role="dialog" aria-modal="${u.drawerFull}" aria-labelledby="gov-d-h" tabindex="-1">
    <div class="drawer-h">
      <span class="pill mono" style="font-size:11.5px;padding:2px 6px">${ic(typeIcon, 12)} ${esc(typeName)}: ${esc(item.code)}</span>
      <span class="sp"></span>
      <button class="ibtn ibtn-sm hide-m" data-a="toggleDrawerFull" data-tip="${u.drawerFull ? 'Side panel' : 'Full page'}" aria-label="Toggle full page">${ic(u.drawerFull ? 'minimize-2' : 'maximize-2', 15)}</button>
      <button class="ibtn ibtn-sm" data-a="closeGovDrawer" data-tip="Close  Esc" aria-label="Close">${ic('x', 16)}</button>
    </div>

    <div class="drawer-b">
      <h2 id="gov-d-h" style="font-size:18px;font-weight:700;color:var(--text);margin:0 0 12px;line-height:1.35">${esc(item.title)}</h2>

      ${
        type === 'control' && item.impactedByAmendment
          ? `<div class="alert danger" style="margin-bottom:16px">
              ${ic('alert-triangle', 15)}
              <div style="flex:1">
                <div style="font-weight:700;font-size:12.5px">Regulatory amendment impact: ${esc(item.impactedByAmendment)}</div>
                <div style="font-size:12px;margin-top:2px">${esc(item.amendmentAlert || '')}</div>
                <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
                  ${
                    item.status === 'DEFICIENT'
                      ? `<button class="btn btn-sm btn-primary" data-a="resolveGap" data-id="${item.id}" style="font-size:11.5px;padding:3px 8px">${ic('check-circle', 12)} Mark effective</button>`
                      : `<span class="pill mono" style="font-size:11px">${ic('check', 11)} Signed off as effective</span>`
                  }
                  <button class="btn btn-sm btn-ghost" data-a="createMitigationTask" data-ctl="${item.id}" style="font-size:11.5px;padding:3px 8px">${ic('plus', 12)} Create update task</button>
                  ${
                    item.statuteSections && item.statuteSections.length
                      ? `<button class="btn btn-sm btn-ghost" data-a="pop" data-pop="linkControl" data-sec="${item.statuteSections[0]}" style="font-size:11.5px;padding:3px 8px">${ic('link', 12)} Link existing control</button>`
                      : ''
                  }
                </div>
              </div>
            </div>`
          : ''
      }

      <div class="dsec">
        <div class="dsec-h"><h3>Description & Specification</h3></div>
        <p style="font-size:13px;line-height:1.55;color:var(--text);margin:0">${esc(item.summary || item.specification || item.consequence || '')}</p>
      </div>

      <dl class="kv" style="margin-top:16px">
        ${item.owner ? `<dt>${ic('user', 14)}Owner</dt><dd>${esc(item.owner)} ${item.ownerRole ? `<span class="muted" style="font-size:11px">(${esc(item.ownerRole)})</span>` : ''}</dd>` : ''}
        ${item.status ? `<dt>${ic('shield', 14)}Status</dt><dd><span class="mono" style="font-size:12px;font-weight:600">${esc(item.status)}</span></dd>` : ''}
        ${item.severity ? `<dt>${ic('alert-octagon', 14)}Severity</dt><dd><span class="mono" style="font-size:12px;font-weight:600">${esc(item.severity)} (Exposure: ${riskExposureScore(item)}/100, ${riskGapStatus(item)})</span></dd>` : ''}
        ${item.authority ? `<dt>${ic('landmark', 14)}Supervisory Authority</dt><dd>${esc(item.authority)}</dd>` : ''}
        ${item.frequency ? `<dt>${ic('clock', 14)}Frequency</dt><dd>${esc(item.frequency)}</dd>` : ''}
        ${item.version ? `<dt>${ic('file-text', 14)}Version</dt><dd>v${esc(item.version)} (Reviewed: ${esc(item.lastReviewDate)})</dd>` : ''}
      </dl>

      <!-- Policy Review Alert if needing review -->
      ${
        type === 'policy' && item.status === 'NEEDS_REVIEW'
          ? `<div class="alert danger" style="margin-top:16px">
              ${ic('alert-triangle', 15)}
              <div style="flex:1">
                <div style="font-weight:700;font-size:12.5px">Review required: Statutory amendment impact</div>
                <div style="font-size:12px;margin-top:2px">Policy requires review and update due to statutory amendment.</div>
                <div style="margin-top:8px;display:flex;gap:8px">
                  <button class="btn btn-sm btn-primary" data-a="signOffPolicy" data-id="${item.id}" style="font-size:11.5px;padding:3px 8px">${ic('check-circle', 12)} Sign off review</button>
                  <button class="btn btn-sm btn-ghost" data-a="createPolicyUpdateTask" data-id="${item.id}" style="font-size:11.5px;padding:3px 8px">${ic('plus', 12)} Create update task</button>
                </div>
              </div>
            </div>`
          : ''
      }

      <!-- Parent Policy (for Controls) -->
      ${
        type === 'control' && item.policyId && policy(item.policyId)
          ? `<div class="dsec" style="margin-top:20px">
              <div class="dsec-h"><h3>Parent Governance Policy</h3></div>
              <div class="row" style="justify-content:space-between;padding:8px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px">
                <div>
                  <span class="mono" style="font-weight:700;font-size:12px">${esc(policy(item.policyId).code)}</span>
                  <span style="font-size:12px;margin-left:6px">${esc(policy(item.policyId).title)}</span>
                </div>
                <button class="btn btn-sm btn-ghost" data-a="openGovDrawer" data-type="policy" data-id="${item.policyId}" style="padding:2px 7px;font-size:11.5px">
                  ${ic('file-text', 12)} Open policy ➔
                </button>
              </div>
            </div>`
          : ''
      }

      <!-- Linked Risk (for Controls) -->
      ${
        type === 'control' && item.riskId && risk(item.riskId)
          ? `<div class="dsec" style="margin-top:20px">
              <div class="dsec-h"><h3>Target Regulatory Risk</h3></div>
              <div class="row" style="justify-content:space-between;padding:8px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px">
                <div>
                  <span class="mono" style="font-weight:700;font-size:12px">${esc(risk(item.riskId).code)}</span>
                  <span style="font-size:12px;margin-left:6px">${esc(risk(item.riskId).title)}</span>
                </div>
                <button class="btn btn-sm btn-ghost" data-a="openGovDrawer" data-type="risk" data-id="${item.riskId}" style="padding:2px 7px;font-size:11.5px">
                  ${ic('alert-triangle', 12)} Open risk ➔
                </button>
              </div>
            </div>`
          : ''
      }

      <!-- Linked Target Risks (for Policies) -->
      ${
        type === 'policy'
          ? (() => {
              const rsks = (item.riskIds || []).map(risk).filter(Boolean);
              if (!rsks.length) return '';
              return `<div class="dsec" style="margin-top:20px">
                <div class="dsec-h"><h3>Target Regulatory Risks (${rsks.length})</h3></div>
                <div class="col" style="gap:6px">
                  ${rsks
                    .map(
                      r => `
                    <div class="row" style="justify-content:space-between;padding:8px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px">
                      <div>
                        <span class="mono" style="font-weight:700;font-size:12px">${esc(r.code)}</span>
                        <span style="font-size:12px;margin-left:6px">${esc(r.title)}</span>
                        <span class="pill mono" style="font-size:10px;margin-left:6px">${esc(r.severity)}</span>
                      </div>
                      <button class="btn btn-sm btn-ghost" data-a="openGovDrawer" data-type="risk" data-id="${r.id}" style="padding:2px 7px;font-size:11.5px">
                        ${ic('alert-triangle', 12)} Open risk ➔
                      </button>
                    </div>`,
                    )
                    .join('')}
                </div>
              </div>`;
            })()
          : ''
      }

      <!-- Linked Operational Controls (for Policies & Risks) -->
      ${
        type === 'policy'
          ? (() => {
              const ctls = allControls().filter(c => c.policyId === item.id || (item.controlIds || []).includes(c.id));
              if (!ctls.length) return '';
              return `<div class="dsec" style="margin-top:20px">
                <div class="dsec-h"><h3>Operational Controls (${ctls.length})</h3></div>
                <div class="col" style="gap:6px">
                  ${ctls.map(renderControlRow).join('')}
                </div>
              </div>`;
            })()
          : ''
      }

      ${
        type === 'risk'
          ? (() => {
              const ctls = riskControls(item);
              if (!ctls.length) return '';
              return `<div class="dsec" style="margin-top:20px">
                <div class="dsec-h"><h3>Enforcing Controls (${ctls.length})</h3></div>
                <div class="col" style="gap:6px">
                  ${ctls.map(renderControlRow).join('')}
                </div>
              </div>`;
            })()
          : ''
      }

      <!-- Linked Policies (for Risks) -->
      ${
        type === 'risk'
          ? (() => {
              const pols = (item.policyIds || []).map(policy).filter(Boolean);
              if (!pols.length) return '';
              return `<div class="dsec" style="margin-top:20px">
                <div class="dsec-h"><h3>Governing Policies (${pols.length})</h3></div>
                <div class="col" style="gap:6px">
                  ${pols
                    .map(
                      p => `
                    <div class="row" style="justify-content:space-between;padding:8px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px">
                      <div>
                        <span class="mono" style="font-weight:700;font-size:12px">${esc(p.code)}</span>
                        <span style="font-size:12px;margin-left:6px">${esc(p.title)}</span>
                      </div>
                      <button class="btn btn-sm btn-ghost" data-a="openGovDrawer" data-type="policy" data-id="${p.id}" style="padding:2px 7px;font-size:11.5px">
                        ${ic('file-text', 12)} Open policy ➔
                      </button>
                    </div>`,
                    )
                    .join('')}
                </div>
              </div>`;
            })()
          : ''
      }

      <!-- Linked Statutory Sections -->
      ${
        item.statuteSections && item.statuteSections.length
          ? `<div class="dsec" style="margin-top:20px">
              <div class="dsec-h"><h3>Statutory Sections & Acts</h3></div>
              <div class="col" style="gap:6px">
                ${item.statuteSections
                  .map(secId => {
                    const label = formatSecBadge(secId);
                    const reg = regulationOfSection(secId);
                    const regId = reg ? reg.id : 'reg-finlex-747-2012';
                    return `<div class="row" style="justify-content:space-between;padding:8px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px">
                      <span class="mono" style="font-size:12.5px;font-weight:600">${esc(label)}</span>
                      <button class="btn btn-sm btn-ghost" data-a="openRegInReader" data-id="${regId}" data-sec="${secId}" style="padding:2px 7px;font-size:11.5px">
                        ${ic('book-open', 12)} Open in reader ➔
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
              <div class="dsec-h"><h3>Linked Compliance Task</h3></div>
              <div class="row" style="justify-content:space-between;padding:8px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px">
                <div>
                  <div style="font-weight:700;font-size:12.5px">${task(item.taskId).key}: ${esc(task(item.taskId).title)}</div>
                  <div class="muted" style="font-size:11px">Status: ${esc(task(item.taskId).status)} · Due: ${esc(task(item.taskId).due || 'Not set')}</div>
                </div>
                <button class="btn btn-sm btn-primary" data-a="openTask" data-id="${item.taskId}" style="padding:2px 7px;font-size:11.5px">
                  ${ic('arrow-right', 12)} Open task
                </button>
              </div>
            </div>`
          : ''
      }
    </div>
  </aside>`;
}

/* ---------------- REGULATORY MONITORING FEED DRAWER ---------------- */
export function feedDrawerHtml(feedId) {
  const item = feedItem(feedId);
  const u = S.ui;
  if (!item) return '';

  const catMeta = getFeedCat(item.category);
  const authMeta = getFeedAuth(item.authorityId, item.authority);
  const scoreClass = feedScoreClass(item.score);
  const scoreLabel = feedScoreLabel(item.score);

  const linkedPolicies = (item.policyIds || []).map(policy).filter(Boolean);
  const linkedControls = (item.controlIds || []).map(control).filter(Boolean);
  const linkedRisks = (item.riskIds || []).map(risk).filter(Boolean);

  return `<aside class="drawer ${u.drawerFull ? 'full' : ''} ${u.fx.drawer ? 'enter' : ''}" role="dialog" aria-modal="${u.drawerFull}" aria-labelledby="feed-d-h" tabindex="-1">
    <div class="drawer-h">
      <div class="row" style="gap:6px">
        <span class="pill mono" style="font-size:11px;padding:2px 8px;border-color:var(--border-strong)">
          ${ic(catMeta.icon, 12)} ${esc(catMeta.label)}
        </span>
        <span class="feed-score-pill ${scoreClass}">
          ${ic('zap', 11)} ${esc(scoreLabel)} (${item.score}/5)
        </span>
      </div>
      <span class="sp"></span>
      <button class="ibtn ibtn-sm hide-m" data-a="toggleDrawerFull" data-tip="${u.drawerFull ? 'Side panel' : 'Full page'}" aria-label="Toggle full page">${ic(u.drawerFull ? 'minimize-2' : 'maximize-2', 15)}</button>
      <button class="ibtn ibtn-sm" data-a="closeFeedDrawer" data-tip="Close  Esc" aria-label="Close">${ic('x', 16)}</button>
    </div>

    <div class="drawer-b">
      <div class="feed-drawer-meta">
        <span class="feed-auth-pill">
          <span>${authMeta.flag}</span>
          <b>${esc(authMeta.short || item.authority)}</b>
        </span>
        <span class="muted mono" style="font-size:11.5px">·</span>
        <span class="pill mono" style="font-size:10.5px">${esc(item.jurisdiction)}</span>
        <span class="muted mono" style="font-size:11.5px">·</span>
        <span class="muted" style="font-size:12px">${esc(item.relativeTime)}</span>
        ${item.status === 'ACKNOWLEDGED' ? `<span class="pill mono" style="font-size:10.5px;color:var(--green)">${ic('check', 11)} Acknowledged</span>` : ''}
        ${item.status === 'IN_MITIGATION' ? `<span class="pill mono" style="font-size:10.5px;color:var(--blue)">${ic('clock', 11)} In Mitigation</span>` : ''}
      </div>

      <h2 id="feed-d-h" style="font-size:19px;font-weight:700;color:var(--text);margin:8px 0 6px;line-height:1.35">${esc(item.title)}</h2>
      ${item.originalTitle ? `<div class="faint" style="font-size:12.5px;font-style:italic;margin-bottom:14px">${esc(item.originalTitle)}</div>` : ''}

      <div class="feed-summary-box">
        <div style="font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-3);margin-bottom:6px">Summary</div>
        <p style="margin:0;font-size:13.5px;line-height:1.55;color:var(--text)">${esc(item.summary)}</p>
      </div>

      <!-- Authentic Compliance Impact & Relevance from rss-mapper-poc -->
      ${
        item.explanation || (item.plainEnglish && item.plainEnglish.whyItMatters)
          ? `<div class="dsec" style="margin-top:20px">
              <div class="dsec-h"><h3>Compliance & Supervisory Impact</h3></div>
              <div class="feed-explanation-box">
                ${esc(item.explanation || item.plainEnglish.whyItMatters)}
              </div>
            </div>`
          : ''
      }

      <!-- Detected Compliance Frameworks (AI Extraction from rss-mapper-poc) -->
      ${
        item.frameworks && item.frameworks.length
          ? `<div class="dsec" style="margin-top:20px">
              <div class="dsec-h"><h3>Detected Compliance Frameworks (${item.frameworks.length})</h3></div>
              <div class="row" style="gap:6px;flex-wrap:wrap">
                ${item.frameworks
                  .map(
                    fw => `<button class="pill mono feed-fw-pill clickable" data-a="openRegFromFramework" data-fw="${esc(fw)}" style="padding:4px 9px;font-size:11.5px;cursor:pointer;border:1px solid var(--border);background:var(--surface-2)" title="Inspect regulation for ${esc(fw)}">
                      ${ic('file-check', 11)} ${esc(fw)} ➔
                    </button>`,
                  )
                  .join('')}
              </div>
            </div>`
          : ''
      }

      <!-- Supervised Market Entities & Firms -->
      ${
        item.vendors && item.vendors.length
          ? `<div class="dsec" style="margin-top:20px">
              <div class="dsec-h"><h3>Market Participants & Entities Involved (${item.vendors.length})</h3></div>
              <div class="row" style="gap:6px;flex-wrap:wrap">
                ${item.vendors
                  .map(
                    v => `<span class="pill mono" style="padding:4px 8px;font-size:11.5px;background:var(--surface-2)">
                      ${ic('building-2', 11)} ${esc(v)}
                    </span>`,
                  )
                  .join('')}
              </div>
            </div>`
          : ''
      }

      <!-- Classified Compliance & Operational Risks -->
      ${
        item.risks && item.risks.length
          ? `<div class="dsec" style="margin-top:20px">
              <div class="dsec-h"><h3>Classified Compliance & Operational Risks (${item.risks.length})</h3></div>
              <div class="col" style="gap:6px">
                ${item.risks
                  .map(
                    r => `<div class="row" style="gap:6px;align-items:flex-start;padding:6px 10px;background:var(--surface-2);border-radius:4px;font-size:12px;color:var(--text)">
                      <span style="color:var(--amber);margin-top:1px">${ic('alert-triangle', 12)}</span>
                      <span>${esc(r)}</span>
                    </div>`,
                  )
                  .join('')}
              </div>
            </div>`
          : ''
      }

      <!-- Statutory Linkage -->
      <div class="dsec" style="margin-top:20px">
        <div class="dsec-h"><h3>Statutory Citation & Direct Reader Link</h3></div>
        <div class="row clickable" style="justify-content:space-between;align-items:center;padding:12px 14px;background:var(--surface-2);border:1px solid var(--border);border-radius:6px;cursor:pointer" data-a="openRegInReader" data-id="${item.statuteId}" data-sec="${item.statuteSec}" title="Jump to ${esc(item.statuteRef)} in regulation reader">
          <div>
            <div class="row" style="gap:6px;align-items:center">
              ${ic('scale', 14)}
              <span class="mono" style="font-weight:700;font-size:13px">${esc(item.statuteRef)}</span>
            </div>
            <div class="muted" style="font-size:11.5px;margin-top:2px">Direct statutory provision indexed in Nordic RegTech library</div>
          </div>
          <button class="btn btn-sm btn-secondary" data-a="openRegInReader" data-id="${item.statuteId}" data-sec="${item.statuteSec}">
            ${ic('book-open', 13)} Open in reader ➔
          </button>
        </div>
      </div>


      <!-- Governance Matrix Linkages -->
      <div class="dsec" style="margin-top:20px">
        <div class="dsec-h"><h3>Internal Governance Matrix Linkages</h3></div>
        <div class="col" style="gap:8px">
          ${
            linkedPolicies.length
              ? `<div>
                  <div class="faint mono" style="font-size:11px;margin-bottom:4px">GOVERNING POLICIES (${linkedPolicies.length})</div>
                  ${linkedPolicies
                    .map(
                      p => `<div class="row" style="justify-content:space-between;padding:8px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;margin-bottom:4px">
                        <div>
                          <span class="mono" style="font-weight:700;font-size:12px">${esc(p.code)}</span>
                          <span style="font-size:12px;margin-left:6px">${esc(p.shortTitle || p.title)}</span>
                          <span class="pill mono" style="font-size:10px;margin-left:6px">${esc(p.status)}</span>
                        </div>
                        <button class="btn btn-sm btn-ghost" data-a="openGovDrawer" data-type="policy" data-id="${p.id}" style="padding:2px 7px;font-size:11.5px">
                          ${ic('file-text', 12)} Open policy ➔
                        </button>
                      </div>`,
                    )
                    .join('')}
                </div>`
              : ''
          }

          ${
            linkedControls.length
              ? `<div>
                  <div class="faint mono" style="font-size:11px;margin-bottom:4px">ENFORCING CONTROLS (${linkedControls.length})</div>
                  ${linkedControls
                    .map(
                      c => `<div class="row" style="justify-content:space-between;padding:8px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;margin-bottom:4px">
                        <div>
                          <span class="mono" style="font-weight:700;font-size:12px">${esc(c.code)}</span>
                          <span style="font-size:12px;margin-left:6px">${esc(c.title)}</span>
                          <span class="pill mono" style="font-size:10px;margin-left:6px">${esc(c.status)}</span>
                        </div>
                        <button class="btn btn-sm btn-ghost" data-a="openGovDrawer" data-type="control" data-id="${c.id}" style="padding:2px 7px;font-size:11.5px">
                          ${ic('shield-check', 12)} Open control ➔
                        </button>
                      </div>`,
                    )
                    .join('')}
                </div>`
              : ''
          }

          ${
            linkedRisks.length
              ? `<div>
                  <div class="faint mono" style="font-size:11px;margin-bottom:4px">RESIDUAL REGULATORY RISKS (${linkedRisks.length})</div>
                  ${linkedRisks
                    .map(
                      r => `<div class="row" style="justify-content:space-between;padding:8px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;margin-bottom:4px">
                        <div>
                          <span class="mono" style="font-weight:700;font-size:12px">${esc(r.code)}</span>
                          <span style="font-size:12px;margin-left:6px">${esc(r.title)}</span>
                          <span class="pill mono" style="font-size:10px;margin-left:6px">${esc(r.severity)}</span>
                        </div>
                        <button class="btn btn-sm btn-ghost" data-a="openGovDrawer" data-type="risk" data-id="${r.id}" style="padding:2px 7px;font-size:11.5px">
                          ${ic('alert-triangle', 12)} Open risk ➔
                        </button>
                      </div>`,
                    )
                    .join('')}
                </div>`
              : ''
          }
        </div>
      </div>

      <!-- Action Footer -->
      <div class="dsec" style="margin-top:24px;padding-top:16px;border-top:1px solid var(--divider)">
        <div class="row" style="gap:8px;flex-wrap:wrap">
          ${
            item.taskId
              ? `<button class="btn btn-primary" data-a="editTask" data-id="${item.taskId}">
                  ${ic('check', 14)} View Mitigation Task (${esc(item.taskId)})
                </button>`
              : `<button class="btn btn-primary" data-a="createTaskFromFeed" data-id="${item.id}">
                  ${ic('plus', 14)} Create Mitigation Task
                </button>`
          }
          ${
            item.status !== 'ACKNOWLEDGED'
              ? `<button class="btn btn-secondary" data-a="ackFeedItem" data-id="${item.id}">
                  ${ic('check', 14)} Mark as Assessed
                </button>`
              : `<span class="pill mono" style="padding:6px 12px;font-size:12px;color:var(--green)">
                  ${ic('check-circle', 13)} Assessed by Compliance
                </span>`
          }
          ${
            item.sourceUrl
              ? `<a class="btn btn-ghost" href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">
                  ${ic('external-link', 14)} View Official Source
                </a>`
              : ''
          }
        </div>
      </div>
    </div>
  </aside>`;
}
