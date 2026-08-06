# FLAME Student Council — Migration Spec
### From "3 Awards" system → Unified "Student Council Election Form"

> **Context:** This system was originally cloned from the FLAME Awards platform, which handled three separate award types. We are now repurposing it to handle a single, unified Student Council election application. Some existing business logic must be preserved carefully — nothing should be destroyed carelessly in the process.

---

## ⚠️ Handle With Care

This migration touches core business logic. Proceed carefully and deliberately — do not delete or overwrite anything beyond what is explicitly listed below.

---

## 1. Database / Models

### 1.1 Tables to Remove
The system currently has three separate award tables that need to be dropped down to the PostgreSQL level:
- `TrailblazerAward.js`
- `CulturalPersonAward.js`
- `SportsPersonAward.js`

**Reason:** Previously, users chose between 3 award options. Now there is only **one** unified form, where the user instead selects the **Council Position** they are applying for.

### 1.2 New Table: `ElectionFormResponse`

Create a new table called `ElectionFormResponse`. Its columns should mirror `TrailblazerAward.js`, plus the following additions:

| Column | Type | Constraints |
|---|---|---|
| `community_service` | `TEXT` | `allowNull: false` |
| `statement_of_purpose` | `TEXT` | `allowNull: false` |
| `read_handbook` | `BOOLEAN` | `allowNull: false` |
| `position_selected` | — | Value comes from the `description` column of the newly created Position table |
| `createdAt` / `updatedAt` (timestamps) | — | Standard Sequelize timestamp columns |

---

## 2. Backend Controllers

### 2.1 `sheetController.js`

- Currently handles **3 sheets** — update it to handle **one Workbook only**.
- **Folder ID update:** Locate the section labeled `FOLDER ID`. Replace it with the new folder:
  - Folder name: `FLAMEStudentCouncil_20262027`
  - Folder link: `https://drive.google.com/drive/folders/1GBzDVaUcwehFAMrziH9zt8Cnjx-sN7ly?dmr=1&ec=wgc-drive-%5Bmodule%5D-goto`

- **`NAME_MAP` update:** Currently contains individual sheet names. Replace with a single Workbook name:
  - Workbook name: `Student Council Workbook - 2026/2027`

- **"Insert Photo" logic & Personal Information sheet:**
  Since we're now working with a single workbook, update the cell mapping on the **"Personal Information"** sheet:

  | Cell | Field |
  |---|---|
  | `B2` | Name |
  | `B3` | Student ID |
  | `B4` | Batch |
  | `B5` | Email |
  | `B6` | Mobile Number |
  | `B7` | **(New)** Position Selected |
  | `B9` | Photo (moved from its previous cell) |

### 2.2 `formProcessingController.js`

- **Prefill logic:** Keep as-is, no changes needed.
- **Existing-submission check:** Update so it checks against the single new `ElectionFormResponse` table only (instead of the old 3-table check).
- All other logic in this controller should remain untouched.
- **Position Selected — timing requirement:** The selected Position value must be sent/available **before** the user opens the workbook. See Section 4 below for the proposed mechanism.

### 2.3 `formSubmissionController.js`

- Ensure the new form fields are included in the submission payload:
  - `statement_of_purpose`
  - `community_service`
  - `read_handbook`
- **Attachment logic:** Comment out entirely for now — no requirement has been received yet regarding file attachments during form submission.
- **Sheet revocation:** Update to follow the new Workbook ID (see Section 2.1 for the folder/workbook details).

---

## 3. Scripts

### 3.1 `scripts/read_sheet_score.py`

Academic, Cultural, and Sports scores now all come from **one central location** — the workbook. On the sheet named **"Total Point"**:

| Cell | Score |
|---|---|
| `B3` | Academic Score |
| `C3` | Sports Score |
| `D3` | Cultural Score |

> **Note:** `B3` does not hold a direct value — it holds a formula. Use the **same mechanism the current script already uses** to convert/resolve formula-based cells into values.

### 3.2 `scripts/insert_photo_formula.py`

- Needs to receive the "Position Selected" value so it can be plugged into the Personal Information section when filling the workbook (see Section 4 for how this value is captured/stored ahead of time).

### 3.3 `scripts/update_template.py`

- Update so that it now targets the single Workbook only (no more handling of 3 separate sheet templates).

---

## 4. Capturing "Position Selected" Ahead of Workbook Creation

**Problem:** The user selects their applied-for Position (from a dropdown sourced from `Position.js`) in the form — but this value needs to be available and ready to plug into `insert_photo_formula.py` / the Personal Information sheet **before** the workbook is generated and opened.

**Proposed approach:** Rather than relying on `localStorage`, it's best to create a **simple database table** that temporarily stores the full form response as the user fills it out. This should include:
- Position Selected
- Statement of Purpose
- Community Service

**Why:** Since Statement of Purpose and Community Service are ~250-word essays, this table should support **autosave** — so that if a user leaves and logs back in later, their writing progress is retrieved from exactly where they left off.

---

## 5. Frontend Changes

### 5.1 `AwardForm.jsx` → Rename to `StudentCouncilForm`

General changes:
- Rename the file/component from `AwardForm.jsx` to `StudentCouncilForm`.
- Remove the logic for selecting between the 3 award types.
- Remove all role-based fields currently present.
- Keep the **Profile** and **Personal Info** sections as they are.

New/updated fields:

1. **Position dropdown** (new)
   - Label: *"Please select which position you are interested in? (You can apply for ONE position ONLY)"*
   - Populated from the Positions list.
   - UI fix needed: ensure the dropdown doesn't get visually blocked/overflow when there are many positions — it should have its own internal scroller.

2. **CGPA** (new, read-only/prefilled)
   - Prefilled automatically — student should not be able to edit it.
   - Use the existing prefill mechanism (see the insert logic for where CGPA is currently retrieved from).

3. **Community Service / Welfare Activities** (new, up to 250 words)
   - Needs a rich text editor with:
     - Expand/open-as-modal option for comfortable writing.
     - Live word count.
     - Turns red when the user exceeds 250 words, but does **not** block them from continuing to type.
   - This is where the autosave logic (Section 4) is especially important — implement a robust "socket" connection that autosaves smoothly and reliably even under heavy network pressure, without crashing.

4. **Statement of Purpose** (new, up to 250 words)
   - Same editor/word-count/autosave behavior as Community Service above.

5. **Workbook button** — *"Student Council - 2026/2027"*
   - On click, triggers all backend logic described above (pre-generates and prefills a copy of the workbook for the user to open).
   - Since this can take time in some cases, add conversational/friendly loading messages during the wait.

6. **Checkbox 1** (new)
   - *"I have read the Student Handbook and the Students' Council Manual and understand rules and regulations of FLAME University."*

7. **Checkbox 2** (new)
   - *"I state that the above is true and that I may have to face penal action if any information is wrong or inaccurate."*

8. **Submission**
   - On submit, trigger a confirmation email to the applicant.

### 5.2 `ApplicantsView.jsx`

- Replace old columns (award-based, etc.) with new columns reflecting the unified Position-based model.
- Remove old award-based filters and related UI.

### 5.3 `Dashboard.jsx`

Update the dashboard to track:
- Total number of applications.
- Gender-based application counts.
- Position-based applicant counts.
- Batch-based applicant counts.
- Batch × Position combined counts.

> Presentation format (graph vs. card) for each metric is flexible — choose whichever fits best per metric.

---

## Summary Checklist

- [ ] Drop `TrailblazerAward`, `CulturalPersonAward`, `SportsPersonAward` tables (PostgreSQL level)
- [ ] Create `ElectionFormResponse` table with new columns
- [ ] Update `sheetController.js` — single workbook, new folder ID, new `NAME_MAP`, new cell mappings (B2–B9)
- [ ] Update `formProcessingController.js` — single-table existence check, keep prefill logic
- [ ] Update `formSubmissionController.js` — new fields in payload, comment out attachment logic, new workbook ID for revocation
- [ ] Update `scripts/read_sheet_score.py` — new "Total Point" sheet, cells B3/C3/D3, formula-resolution mechanism
- [ ] Update `scripts/insert_photo_formula.py` — accept Position Selected value
- [ ] Update `scripts/update_template.py` — single workbook only
- [ ] Build temporary autosave table/mechanism for Position, Statement of Purpose, Community Service
- [ ] Rename & rebuild `AwardForm.jsx` → `StudentCouncilForm` with all new fields, dropdown scroller, rich text editors, checkboxes, loading states, confirmation email
- [ ] Update `ApplicantsView.jsx` with new columns
- [ ] Update `Dashboard.jsx` with new metrics
