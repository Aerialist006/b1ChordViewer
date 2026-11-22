use futures::future::join_all;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::sync::OnceLock;

const B1_API_BASE: &str = "https://api.churchapps.org";

static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        reqwest::Client::builder()
            .default_headers(headers)
            .build()
            .expect("Failed to create HTTP client")
    })
}

fn resolve_auth_header(custom_token: Option<&str>) -> Result<HeaderValue, String> {
    let raw = custom_token
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            "No B1 API Key configured. Please enter your ChurchApps (B1.church) API Key.".to_string()
        })?;

    let clean_token = raw.trim_start_matches("Bearer ").trim();
    HeaderValue::from_str(&format!("Bearer {}", clean_token))
        .map_err(|e| format!("Invalid API key format: {}", e))
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct B1PlanSummary {
    pub id: String,
    pub name: String,
    pub service_date: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct B1ArrangementKey {
    pub id: String,
    pub arrangement_id: String,
    pub key_signature: String,
    pub short_description: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct B1LibrarySong {
    pub id: String,
    pub name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct B1SongArrangementOption {
    pub arrangement_id: String,
    pub arrangement_name: String,
    pub artist: String,
    pub keys: Vec<B1ArrangementKey>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct B1ServiceSong {
    pub plan_item_id: String,
    pub arrangement_key_id: String,
    pub arrangement_id: String,
    pub title: String,
    pub artist: String,
    pub key_signature: String,
    pub bpm: Option<i64>,
    pub raw_chordpro: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct B1ServicePayload {
    pub active_plan: B1PlanSummary,
    pub all_plans: Vec<B1PlanSummary>,
    pub songs: Vec<B1ServiceSong>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ParsedBlock {
    pub header: Option<String>,
    pub lines: Vec<String>,
}

fn is_section_header(line: &str, section_keywords: &[String]) -> bool {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return false;
    }

    let is_single_bracket = trimmed.starts_with('[')
        && trimmed.ends_with(']')
        && !trimmed[1..trimmed.len() - 1].contains('[')
        && !trimmed[1..trimmed.len() - 1].contains(']');

    let inner = if is_single_bracket {
        trimmed[1..trimmed.len() - 1].trim()
    } else {
        trimmed
    };

    if inner.is_empty() {
        return false;
    }

    if inner
        .chars()
        .next()
        .map(|c| ('1'..='7').contains(&c))
        .unwrap_or(false)
    {
        return false;
    }

    if is_single_bracket {
        return true;
    }

    let inner_lower = inner.to_lowercase();

    for kw in section_keywords {
        let clean_kw = kw.trim().to_lowercase();
        if clean_kw.is_empty() {
            continue;
        }
        if inner_lower == clean_kw {
            return true;
        }
        if let Some(rest) = inner_lower.strip_prefix(&clean_kw) {
            let rest_trimmed = rest.trim_start();
            if !rest_trimmed.is_empty()
                && rest_trimmed
                    .chars()
                    .all(|c| c.is_ascii_digit() || c == ':' || c == '-' || c.is_whitespace())
            {
                return true;
            }
        }
    }

    false
}

#[tauri::command]
fn parse_and_deduplicate_blocks(
    raw_chordpro: String,
    section_keywords: Vec<String>,
    deduplicate: bool,
) -> Vec<ParsedBlock> {
    let mut raw_blocks: Vec<ParsedBlock> = Vec::new();
    let mut current = ParsedBlock {
        header: None,
        lines: Vec::new(),
    };

    let push_cleaned = |blk: ParsedBlock, out: &mut Vec<ParsedBlock>| {
        let start = blk.lines.iter().position(|l| !l.trim().is_empty());
        let end = blk.lines.iter().rposition(|l| !l.trim().is_empty());

        let cleaned_lines = match (start, end) {
            (Some(s), Some(e)) if s <= e => blk.lines[s..=e].to_vec(),
            _ => Vec::new(),
        };

        if blk.header.is_some() || !cleaned_lines.is_empty() {
            out.push(ParsedBlock {
                header: blk.header,
                lines: cleaned_lines,
            });
        }
    };

    for line in raw_chordpro.lines() {
        if is_section_header(line, &section_keywords) {
            push_cleaned(current, &mut raw_blocks);
            current = ParsedBlock {
                header: Some(line.trim().to_string()),
                lines: Vec::new(),
            };
        } else {
            current.lines.push(line.to_string());
        }
    }
    push_cleaned(current, &mut raw_blocks);

    if !deduplicate {
        return raw_blocks;
    }

    let mut seen_bodies: HashSet<String> = HashSet::new();
    let mut unique_blocks: Vec<ParsedBlock> = Vec::new();

    for blk in raw_blocks {
        let normalized_body = blk
            .lines
            .iter()
            .map(|l| l.split_whitespace().collect::<Vec<_>>().join(" ").to_lowercase())
            .filter(|l| !l.is_empty())
            .collect::<Vec<_>>()
            .join("\n");

        if normalized_body.is_empty() || seen_bodies.insert(normalized_body) {
            unique_blocks.push(blk);
        }
    }

    unique_blocks
}

#[tauri::command]
async fn fetch_service_view(
    plan_id: Option<String>,
    api_token: Option<String>,
) -> Result<B1ServicePayload, String> {
    let client = get_client();
    let auth_header = resolve_auth_header(api_token.as_deref())?;

    let plans_url = format!("{}/doing/plans", B1_API_BASE);
    let plans_resp = client
        .get(&plans_url)
        .header(AUTHORIZATION, auth_header.clone())
        .send()
        .await
        .map_err(|e| format!("Failed to fetch plans: {}", e))?;

    if !plans_resp.status().is_success() {
        return Err(format!(
            "B1 API returned status {} (check your Church API Key in Settings).",
            plans_resp.status()
        ));
    }

    let raw_plans: Vec<Value> = plans_resp.json().await.map_err(|e| e.to_string())?;
    if raw_plans.is_empty() {
        return Err("No service plans found in B1.church for this API key.".to_string());
    }

    let mut all_plans: Vec<B1PlanSummary> = raw_plans
        .into_iter()
        .map(|v| B1PlanSummary {
            id: v.get("id").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
            name: v.get("name").and_then(|x| x.as_str()).unwrap_or("Service Plan").to_string(),
            service_date: v.get("serviceDate").and_then(|x| x.as_str()).map(|s| s.to_string()),
        })
        .collect();

    all_plans.sort_by(|a, b| b.service_date.cmp(&a.service_date));

    let active_plan = if let Some(ref pid) = plan_id {
        all_plans
            .iter()
            .find(|p| &p.id == pid)
            .cloned()
            .unwrap_or_else(|| all_plans[0].clone())
    } else {
        all_plans[0].clone()
    };

    let items_url = format!("{}/doing/planItems/plan/{}", B1_API_BASE, active_plan.id);
    let items_resp = client
        .get(&items_url)
        .header(AUTHORIZATION, auth_header.clone())
        .send()
        .await
        .map_err(|e| format!("Failed to fetch plan items: {}", e))?;

    let raw_items: Vec<Value> = items_resp.json().await.map_err(|e| e.to_string())?;

    let mut raw_song_nodes = Vec::new();
    fn collect_song_nodes(nodes: &[Value], out: &mut Vec<(String, String, String)>) {
        let mut sorted: Vec<&Value> = nodes.iter().collect();
        sorted.sort_by_key(|n| n.get("sort").and_then(|x| x.as_i64()).unwrap_or(0));

        for node in sorted {
            let item_type = node.get("itemType").and_then(|x| x.as_str()).unwrap_or("");
            let related_id = node.get("relatedId").and_then(|x| x.as_str()).unwrap_or("");
            if !related_id.is_empty() && item_type != "header" && item_type != "section" {
                let item_id = node.get("id").and_then(|x| x.as_str()).unwrap_or_default().to_string();
                let label = node.get("label").and_then(|x| x.as_str()).unwrap_or("Song").to_string();
                out.push((item_id, label, related_id.to_string()));
            }
            if let Some(children) = node.get("children").and_then(|c| c.as_array()) {
                collect_song_nodes(children, out);
            }
        }
    }
    collect_song_nodes(&raw_items, &mut raw_song_nodes);

    let song_futures = raw_song_nodes
        .into_iter()
        .map(|(plan_item_id, fallback_label, related_id)| {
            let auth = auth_header.clone();
            async move {
                resolve_service_song(client, auth, plan_item_id, fallback_label, related_id).await
            }
        });

    let resolved = join_all(song_futures).await;
    let songs: Vec<B1ServiceSong> = resolved.into_iter().flatten().collect();

    Ok(B1ServicePayload {
        active_plan,
        all_plans,
        songs,
    })
}

fn parse_arrangement_key(v: &Value) -> B1ArrangementKey {
    B1ArrangementKey {
        id: v.get("id").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        arrangement_id: v
            .get("arrangementId")
            .and_then(|x| x.as_str())
            .unwrap_or_default()
            .to_string(),
        key_signature: v
            .get("keySignature")
            .and_then(|x| x.as_str())
            .unwrap_or_default()
            .trim()
            .to_string(),
        short_description: v
            .get("shortDescription")
            .and_then(|x| x.as_str())
            .unwrap_or_default()
            .trim()
            .to_string(),
    }
}

#[tauri::command]
async fn fetch_arrangement_keys(
    arrangement_id: String,
    api_token: Option<String>,
) -> Result<Vec<B1ArrangementKey>, String> {
    if arrangement_id.trim().is_empty() {
        return Ok(Vec::new());
    }
    let client = get_client();
    let auth_header = resolve_auth_header(api_token.as_deref())?;

    let url = format!(
        "{}/content/arrangementKeys/arrangement/{}",
        B1_API_BASE, arrangement_id
    );
    let resp = client
        .get(&url)
        .header(AUTHORIZATION, auth_header)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch arrangement keys: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Failed to load arrangement keys (HTTP {}).",
            resp.status()
        ));
    }

    let raw: Vec<Value> = resp.json().await.map_err(|e| e.to_string())?;
    Ok(raw.iter().map(parse_arrangement_key).collect())
}

#[tauri::command]
async fn save_arrangement_key(
    id: Option<String>,
    arrangement_id: String,
    key_signature: String,
    short_description: String,
    api_token: Option<String>,
) -> Result<B1ArrangementKey, String> {
    if arrangement_id.trim().is_empty() {
        return Err("Missing arrangement ID for this song.".to_string());
    }

    let client = get_client();
    let auth_header = resolve_auth_header(api_token.as_deref())?;
    let clean_key = key_signature.trim().to_string();
    let clean_desc = short_description.trim().to_string();

    let payload_obj: Value = if let Some(existing_id) = id.as_deref().filter(|s| !s.trim().is_empty()) {
        let get_url = format!("{}/content/arrangementKeys/{}", B1_API_BASE, existing_id);
        let get_resp = client
            .get(&get_url)
            .header(AUTHORIZATION, auth_header.clone())
            .send()
            .await
            .map_err(|e| format!("Failed to fetch arrangement key: {}", e))?;

        let mut ak_json: Value = if get_resp.status().is_success() {
            get_resp.json().await.unwrap_or_else(|_| json!({}))
        } else {
            json!({ "id": existing_id, "arrangementId": arrangement_id })
        };

        if let Some(obj) = ak_json.as_object_mut() {
            obj.insert("keySignature".to_string(), Value::String(clean_key.clone()));
            obj.insert(
                "shortDescription".to_string(),
                Value::String(clean_desc.clone()),
            );
        }
        ak_json
    } else {
        json!({
            "arrangementId": arrangement_id,
            "keySignature": clean_key,
            "shortDescription": clean_desc
        })
    };

    let post_url = format!("{}/content/arrangementKeys", B1_API_BASE);
    let post_resp = client
        .post(&post_url)
        .header(AUTHORIZATION, auth_header)
        .json(&json!([payload_obj]))
        .send()
        .await
        .map_err(|e| format!("Failed to save key to B1: {}", e))?;

    let status = post_resp.status();
    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Err(
            "Write permission denied (401/403). Your B1 API key is read-only for keys.".to_string(),
        );
    }
    if !status.is_success() {
        let body = post_resp.text().await.unwrap_or_default();
        return Err(format!("B1 rejected key save (HTTP {}): {}", status, body));
    }

    let returned: Value = post_resp.json().await.unwrap_or_else(|_| json!([]));
    if let Some(first) = returned.as_array().and_then(|arr| arr.first()) {
        return Ok(parse_arrangement_key(first));
    }
    if returned.is_object() {
        return Ok(parse_arrangement_key(&returned));
    }

    Ok(B1ArrangementKey {
        id: id.unwrap_or_default(),
        arrangement_id,
        key_signature: clean_key,
        short_description: clean_desc,
    })
}

fn find_plan_item<'a>(nodes: &'a [Value], target_id: &str) -> Option<&'a Value> {
    for node in nodes {
        if node.get("id").and_then(|x| x.as_str()) == Some(target_id) {
            return Some(node);
        }
        if let Some(children) = node.get("children").and_then(|c| c.as_array()) {
            if let Some(found) = find_plan_item(children, target_id) {
                return Some(found);
            }
        }
    }
    None
}

#[tauri::command]
async fn replace_plan_item_key(
    plan_id: String,
    plan_item_id: String,
    new_arrangement_key_id: String,
    new_key_label: String,
    api_token: Option<String>,
) -> Result<String, String> {
    if plan_id.trim().is_empty() || plan_item_id.trim().is_empty() {
        return Err("Missing plan or plan item ID.".to_string());
    }

    let client = get_client();
    let auth_header = resolve_auth_header(api_token.as_deref())?;

    // 1. Fetch current plan items to copy parentId, sort, itemType, label, etc.
    let items_url = format!("{}/doing/planItems/plan/{}", B1_API_BASE, plan_id);
    let items_resp = client
        .get(&items_url)
        .header(AUTHORIZATION, auth_header.clone())
        .send()
        .await
        .map_err(|e| format!("Failed to fetch plan items: {}", e))?;

    if !items_resp.status().is_success() {
        return Err(format!(
            "Failed to read plan items (HTTP {}).",
            items_resp.status()
        ));
    }

    let raw_items: Vec<Value> = items_resp.json().await.map_err(|e| e.to_string())?;
    let existing_item = find_plan_item(&raw_items, &plan_item_id)
        .ok_or_else(|| "Could not locate this song inside the active plan.".to_string())?;

    let mut new_item = existing_item.clone();
    if let Some(obj) = new_item.as_object_mut() {
        obj.remove("id");
        obj.remove("children");
        obj.insert("planId".to_string(), Value::String(plan_id));
        obj.insert(
            "relatedId".to_string(),
            Value::String(new_arrangement_key_id),
        );

        // Update the Order of Service subtitle (e.g. "Coros - Letra · Default" -> "Coros - Letra · Disco (F)")
        let clean_label = new_key_label.trim();
        if !clean_label.is_empty() {
            let old_desc = obj
                .get("description")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .trim();

            let updated_desc = if let Some((prefix, _)) = old_desc.split_once('·') {
                format!("{} · {}", prefix.trim(), clean_label)
            } else if !old_desc.is_empty() {
                format!("{} · {}", old_desc, clean_label)
            } else {
                clean_label.to_string()
            };

            obj.insert("description".to_string(), Value::String(updated_desc));
        }
    }

    // 2. Delete the old song entry from the plan
    let del_url = format!("{}/doing/planItems/{}", B1_API_BASE, plan_item_id);
    let del_resp = client
        .delete(&del_url)
        .header(AUTHORIZATION, auth_header.clone())
        .send()
        .await
        .map_err(|e| format!("Failed to remove old plan item: {}", e))?;

    let del_status = del_resp.status();
    if del_status.as_u16() == 401 || del_status.as_u16() == 403 {
        return Err(
            "Write permission denied (401/403). Your B1 API key cannot modify service plans."
                .to_string(),
        );
    }
    if !del_status.is_success() {
        let body = del_resp.text().await.unwrap_or_default();
        return Err(format!(
            "Failed to delete song from plan (HTTP {}): {}",
            del_status, body
        ));
    }

    // 3. Reimport the song into the plan with the new arrangementKey & updated description
    let post_url = format!("{}/doing/planItems", B1_API_BASE);
    let post_resp = client
        .post(&post_url)
        .header(AUTHORIZATION, auth_header)
        .json(&json!([new_item]))
        .send()
        .await
        .map_err(|e| format!("Failed to reimport song into plan: {}", e))?;

    let post_status = post_resp.status();
    if !post_status.is_success() {
        let body = post_resp.text().await.unwrap_or_default();
        return Err(format!(
            "Failed to reimport song into plan (HTTP {}): {}",
            post_status, body
        ));
    }

    let created: Value = post_resp.json().await.unwrap_or_else(|_| json!([]));
    let new_id = created
        .as_array()
        .and_then(|a| a.first())
        .and_then(|v| v.get("id"))
        .and_then(|x| x.as_str())
        .or_else(|| created.get("id").and_then(|x| x.as_str()))
        .unwrap_or_default()
        .to_string();

    Ok(new_id)
}

#[tauri::command]
async fn reorder_plan_songs(
    plan_id: String,
    ordered_plan_item_ids: Vec<String>,
    removed_plan_item_ids: Vec<String>,
    api_token: Option<String>,
) -> Result<(), String> {
    if plan_id.trim().is_empty() {
        return Err("Missing active plan ID.".to_string());
    }

    let client = get_client();
    let auth_header = resolve_auth_header(api_token.as_deref())?;

    // 1. Delete any removed songs from the plan
    for del_id in &removed_plan_item_ids {
        if del_id.trim().is_empty() {
            continue;
        }
        let del_url = format!("{}/doing/planItems/{}", B1_API_BASE, del_id);
        let del_resp = client
            .delete(&del_url)
            .header(AUTHORIZATION, auth_header.clone())
            .send()
            .await
            .map_err(|e| format!("Failed to remove song from plan: {}", e))?;

        let status = del_resp.status();
        if status.as_u16() == 401 || status.as_u16() == 403 {
            return Err(
                "Write permission denied (401/403). Your B1 API key cannot edit service plans."
                    .to_string(),
            );
        }
        if !status.is_success() {
            let body = del_resp.text().await.unwrap_or_default();
            return Err(format!(
                "Failed to remove song from plan (HTTP {}): {}",
                status, body
            ));
        }
    }

    if ordered_plan_item_ids.is_empty() {
        return Ok(());
    }

    // 2. Fetch current plan items so all existing fields (parentId, label, description, etc.) are preserved
    let items_url = format!("{}/doing/planItems/plan/{}", B1_API_BASE, plan_id);
    let items_resp = client
        .get(&items_url)
        .header(AUTHORIZATION, auth_header.clone())
        .send()
        .await
        .map_err(|e| format!("Failed to fetch plan items: {}", e))?;

    if !items_resp.status().is_success() {
        return Err(format!(
            "Failed to read plan items (HTTP {}).",
            items_resp.status()
        ));
    }

    let raw_items: Vec<Value> = items_resp.json().await.map_err(|e| e.to_string())?;

    let mut updated_items: Vec<Value> = Vec::new();
    for (idx, item_id) in ordered_plan_item_ids.iter().enumerate() {
        if let Some(existing) = find_plan_item(&raw_items, item_id) {
            let mut item_copy = existing.clone();
            if let Some(obj) = item_copy.as_object_mut() {
                obj.remove("children");
                obj.insert("planId".to_string(), Value::String(plan_id.clone()));
                obj.insert("sort".to_string(), json!((idx + 1) as i64));
            }
            updated_items.push(item_copy);
        }
    }

    if updated_items.is_empty() {
        return Ok(());
    }

    // 3. POST updated sort order back to B1.church
    let post_url = format!("{}/doing/planItems", B1_API_BASE);
    let post_resp = client
        .post(&post_url)
        .header(AUTHORIZATION, auth_header)
        .json(&updated_items)
        .send()
        .await
        .map_err(|e| format!("Failed to save order of service: {}", e))?;

    let status = post_resp.status();
    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Err(
            "Write permission denied (401/403). Your B1 API key cannot update the Order of Service."
                .to_string(),
        );
    }
    if !status.is_success() {
        let body = post_resp.text().await.unwrap_or_default();
        return Err(format!(
            "B1 rejected order update (HTTP {}): {}",
            status, body
        ));
    }

    Ok(())
}

#[tauri::command]
async fn fetch_church_songs(
    api_token: Option<String>,
) -> Result<Vec<B1LibrarySong>, String> {
    let client = get_client();
    let auth_header = resolve_auth_header(api_token.as_deref())?;

    let url = format!("{}/content/songs", B1_API_BASE);
    let resp = client
        .get(&url)
        .header(AUTHORIZATION, auth_header)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch church songs: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Failed to load church song library (HTTP {}).",
            resp.status()
        ));
    }

    let raw: Vec<Value> = resp.json().await.map_err(|e| e.to_string())?;
    let mut songs: Vec<B1LibrarySong> = raw
        .into_iter()
        .filter_map(|v| {
            let id = v.get("id").and_then(|x| x.as_str())?.to_string();
            let name = v
                .get("name")
                .or_else(|| v.get("title"))
                .and_then(|x| x.as_str())
                .unwrap_or("Untitled Song")
                .trim()
                .to_string();
            Some(B1LibrarySong { id, name })
        })
        .collect();

    songs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(songs)
}

#[tauri::command]
async fn fetch_song_add_options(
    song_id: String,
    api_token: Option<String>,
) -> Result<Vec<B1SongArrangementOption>, String> {
    if song_id.trim().is_empty() {
        return Ok(Vec::new());
    }

    let client = get_client();
    let auth_header = resolve_auth_header(api_token.as_deref())?;

    let arr_url = format!("{}/content/arrangements/song/{}", B1_API_BASE, song_id);
    let arr_resp = client
        .get(&arr_url)
        .header(AUTHORIZATION, auth_header.clone())
        .send()
        .await
        .map_err(|e| format!("Failed to fetch song arrangements: {}", e))?;

    if !arr_resp.status().is_success() {
        return Err(format!(
            "Failed to load arrangements (HTTP {}).",
            arr_resp.status()
        ));
    }

    let raw_arrs: Vec<Value> = arr_resp.json().await.map_err(|e| e.to_string())?;

    let futures = raw_arrs.into_iter().map(|arr| {
        let auth = auth_header.clone();
        async move {
            let arrangement_id = arr
                .get("id")
                .and_then(|x| x.as_str())
                .unwrap_or_default()
                .to_string();
            let arrangement_name = arr
                .get("name")
                .and_then(|x| x.as_str())
                .unwrap_or("Default")
                .trim()
                .to_string();
            let song_detail_id = arr
                .get("songDetailId")
                .and_then(|x| x.as_str())
                .unwrap_or_default()
                .to_string();

            let mut artist = String::new();
            if !song_detail_id.is_empty() {
                let sd_url = format!("{}/content/songDetails/{}", B1_API_BASE, song_detail_id);
                if let Ok(resp) = client
                    .get(&sd_url)
                    .header(AUTHORIZATION, auth.clone())
                    .send()
                    .await
                {
                    if let Ok(sd) = resp.json::<Value>().await {
                        if let Some(a) = sd.get("artist").and_then(|x| x.as_str()) {
                            artist = a.trim().to_string();
                        }
                    }
                }
            }

            let mut keys = Vec::new();
            if !arrangement_id.is_empty() {
                let keys_url = format!(
                    "{}/content/arrangementKeys/arrangement/{}",
                    B1_API_BASE, arrangement_id
                );
                if let Ok(resp) = client
                    .get(&keys_url)
                    .header(AUTHORIZATION, auth)
                    .send()
                    .await
                {
                    if let Ok(raw_keys) = resp.json::<Vec<Value>>().await {
                        keys = raw_keys.iter().map(parse_arrangement_key).collect();
                    }
                }
            }

            B1SongArrangementOption {
                arrangement_id,
                arrangement_name,
                artist,
                keys,
            }
        }
    });

    Ok(join_all(futures).await)
}

#[tauri::command]
async fn add_song_to_plan(
    plan_id: String,
    arrangement_key_id: String,
    label: String,
    description: String,
    api_token: Option<String>,
) -> Result<String, String> {
    if plan_id.trim().is_empty() || arrangement_key_id.trim().is_empty() {
        return Err("Missing plan ID or arrangement key ID.".to_string());
    }

    let client = get_client();
    let auth_header = resolve_auth_header(api_token.as_deref())?;

    // 1. Inspect existing plan items to place the new song inside the same section & at the end
    let items_url = format!("{}/doing/planItems/plan/{}", B1_API_BASE, plan_id);
    let items_resp = client
        .get(&items_url)
        .header(AUTHORIZATION, auth_header.clone())
        .send()
        .await
        .map_err(|e| format!("Failed to fetch plan items: {}", e))?;

    let raw_items: Vec<Value> = if items_resp.status().is_success() {
        items_resp.json().await.unwrap_or_default()
    } else {
        Vec::new()
    };

    // Find parentId used by existing songs, or fall back to the first header/section
    let mut target_parent_id: Option<String> = None;
    let mut max_sort: i64 = 0;

    fn inspect_plan_tree(
        nodes: &[Value],
        target_parent: &mut Option<String>,
        max_sort: &mut i64,
    ) {
        for node in nodes {
            let item_type = node.get("itemType").and_then(|x| x.as_str()).unwrap_or("");
            let related_id = node.get("relatedId").and_then(|x| x.as_str()).unwrap_or("");
            let sort_val = node.get("sort").and_then(|x| x.as_i64()).unwrap_or(0);

            if !related_id.is_empty() && item_type != "header" && item_type != "section" {
                if let Some(pid) = node.get("parentId").and_then(|x| x.as_str()) {
                    if !pid.is_empty() {
                        *target_parent = Some(pid.to_string());
                    }
                }
                if sort_val > *max_sort {
                    *max_sort = sort_val;
                }
            } else if (item_type == "header" || item_type == "section") && target_parent.is_none() {
                if let Some(id) = node.get("id").and_then(|x| x.as_str()) {
                    if !id.is_empty() {
                        *target_parent = Some(id.to_string());
                    }
                }
            }

            if let Some(children) = node.get("children").and_then(|c| c.as_array()) {
                inspect_plan_tree(children, target_parent, max_sort);
            }
        }
    }
    inspect_plan_tree(&raw_items, &mut target_parent_id, &mut max_sort);

    let mut new_item = json!({
        "planId": plan_id,
        "sort": max_sort + 1,
        "itemType": "arrangementKey",
        "relatedId": arrangement_key_id,
        "label": label.trim(),
        "description": description.trim(),
        "seconds": 0
    });

    if let Some(pid) = target_parent_id {
        if let Some(obj) = new_item.as_object_mut() {
            obj.insert("parentId".to_string(), Value::String(pid));
        }
    }

    let post_url = format!("{}/doing/planItems", B1_API_BASE);
    let post_resp = client
        .post(&post_url)
        .header(AUTHORIZATION, auth_header)
        .json(&json!([new_item]))
        .send()
        .await
        .map_err(|e| format!("Failed to add song to plan: {}", e))?;

    let status = post_resp.status();
    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Err(
            "Write permission denied (401/403). Your B1 API key cannot add songs to service plans."
                .to_string(),
        );
    }
    if !status.is_success() {
        let body = post_resp.text().await.unwrap_or_default();
        return Err(format!(
            "B1 rejected adding song to plan (HTTP {}): {}",
            status, body
        ));
    }

    let created: Value = post_resp.json().await.unwrap_or_else(|_| json!([]));
    let new_id = created
        .as_array()
        .and_then(|a| a.first())
        .and_then(|v| v.get("id"))
        .and_then(|x| x.as_str())
        .or_else(|| created.get("id").and_then(|x| x.as_str()))
        .unwrap_or_default()
        .to_string();

    Ok(new_id)
}

#[tauri::command]
async fn update_song_lyrics(
    arrangement_id: String,
    new_lyrics: String,
    api_token: Option<String>,
) -> Result<String, String> {
    if arrangement_id.trim().is_empty() {
        return Err("Missing arrangement ID for this song.".to_string());
    }

    let client = get_client();
    let auth_header = resolve_auth_header(api_token.as_deref())?;

    let get_url = format!("{}/content/arrangements/{}", B1_API_BASE, arrangement_id);
    let get_resp = client
        .get(&get_url)
        .header(AUTHORIZATION, auth_header.clone())
        .send()
        .await
        .map_err(|e| format!("Failed to fetch arrangement: {}", e))?;

    if !get_resp.status().is_success() {
        return Err(format!(
            "Could not load arrangement (HTTP {}).",
            get_resp.status()
        ));
    }

    let mut arr_json: Value = get_resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse arrangement JSON: {}", e))?;

    if let Some(obj) = arr_json.as_object_mut() {
        obj.insert("lyrics".to_string(), Value::String(new_lyrics.clone()));
    } else {
        return Err("Unexpected arrangement format returned by B1.".to_string());
    }

    let post_url = format!("{}/content/arrangements", B1_API_BASE);
    let post_resp = client
        .post(&post_url)
        .header(AUTHORIZATION, auth_header)
        .json(&json!([arr_json]))
        .send()
        .await
        .map_err(|e| format!("Failed to save chords/lyrics to B1: {}", e))?;

    let status = post_resp.status();
    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Err(
            "Write permission denied (401/403). Your B1 API key does not have write access to edit songs."
                .to_string(),
        );
    }
    if !status.is_success() {
        let body = post_resp.text().await.unwrap_or_default();
        return Err(format!(
            "B1 rejected song update (HTTP {}): {}",
            status, body
        ));
    }

    Ok(new_lyrics)
}

async fn resolve_service_song(
    client: &reqwest::Client,
    auth_header: HeaderValue,
    plan_item_id: String,
    fallback_label: String,
    related_id: String,
) -> Option<B1ServiceSong> {
    let ak_url = format!("{}/content/arrangementKeys/{}", B1_API_BASE, related_id);
    let mut key_signature = String::new();
    let mut arrangement_id = String::new();

    if let Ok(resp) = client
        .get(&ak_url)
        .header(AUTHORIZATION, auth_header.clone())
        .send()
        .await
    {
        if let Ok(ak_json) = resp.json::<Value>().await {
            if let Some(k) = ak_json.get("keySignature").and_then(|x| x.as_str()) {
                key_signature = k.trim().to_string();
            }
            if let Some(aid) = ak_json.get("arrangementId").and_then(|x| x.as_str()) {
                arrangement_id = aid.to_string();
            }
        }
    }

    let arr_val: Value = if !arrangement_id.is_empty() {
        let arr_url = format!("{}/content/arrangements/{}", B1_API_BASE, arrangement_id);
        client
            .get(&arr_url)
            .header(AUTHORIZATION, auth_header.clone())
            .send()
            .await
            .ok()?
            .json()
            .await
            .ok()?
    } else {
        let arr_url = format!("{}/content/arrangements/song/{}", B1_API_BASE, related_id);
        let list: Vec<Value> = client
            .get(&arr_url)
            .header(AUTHORIZATION, auth_header.clone())
            .send()
            .await
            .ok()?
            .json()
            .await
            .ok()?;
        let first = list.into_iter().next()?;
        if let Some(id_str) = first.get("id").and_then(|x| x.as_str()) {
            arrangement_id = id_str.to_string();
        }
        first
    };

    let raw_chordpro = arr_val
        .get("lyrics")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();

    let song_detail_id = arr_val
        .get("songDetailId")
        .and_then(|x| x.as_str())
        .unwrap_or("");

    let mut title = fallback_label;
    let mut artist = String::new();
    let mut bpm = None;

    if !song_detail_id.is_empty() {
        let sd_url = format!("{}/content/songDetails/{}", B1_API_BASE, song_detail_id);
        if let Ok(resp) = client
            .get(&sd_url)
            .header(AUTHORIZATION, auth_header)
            .send()
            .await
        {
            if let Ok(sd) = resp.json::<Value>().await {
                if let Some(t) = sd.get("title").and_then(|x| x.as_str()) {
                    if !t.is_empty() {
                        title = t.to_string();
                    }
                }
                if let Some(a) = sd.get("artist").and_then(|x| x.as_str()) {
                    artist = a.to_string();
                }
                bpm = sd.get("bpm").and_then(|x| x.as_i64());
                if key_signature.is_empty() {
                    if let Some(k) = sd.get("keySignature").and_then(|x| x.as_str()) {
                        key_signature = k.trim().to_string();
                    }
                }
            }
        }
    }

    Some(B1ServiceSong {
        plan_item_id,
        arrangement_key_id: related_id,
        arrangement_id,
        title,
        artist,
        key_signature,
        bpm,
        raw_chordpro,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            fetch_service_view,
            parse_and_deduplicate_blocks,
            fetch_arrangement_keys,
            save_arrangement_key,
            replace_plan_item_key,
            reorder_plan_songs,
            fetch_church_songs,
            fetch_song_add_options,
            add_song_to_plan,
            update_song_lyrics
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}