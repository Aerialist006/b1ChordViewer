use futures::future::join_all;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::OnceLock;

const B1_API_BASE: &str = "https://api.churchapps.org";

const B1_API_BASE: &str = "https://api.churchapps.org";

fn get_b1_token() -> &'static str {
    if let Some(tok) = option_env!("B1_TOKEN") {
        if !tok.is_empty() {
            return tok;
        }
    }
}

static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        let clean_token = get_b1_token().trim().trim_start_matches("Bearer ").trim();
        let auth_val = format!("Bearer {}", clean_token);
        if let Ok(hv) = HeaderValue::from_str(&auth_val) {
            headers.insert(AUTHORIZATION, hv);
        }
        reqwest::Client::builder()
            .default_headers(headers)
            .build()
            .expect("Failed to create HTTP client")
    })
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct B1PlanSummary {
    pub id: String,
    pub name: String,
    pub service_date: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct B1ServiceSong {
    pub plan_item_id: String,
    pub arrangement_key_id: String,
    pub title: String,
    pub artist: String,
    pub key_signature: String, // Empty string "" if not specified in B1
    pub bpm: Option<i64>,
    pub raw_chordpro: String,  // Stored as Nashville in B1
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct B1ServicePayload {
    pub active_plan: B1PlanSummary,
    pub all_plans: Vec<B1PlanSummary>,
    pub songs: Vec<B1ServiceSong>,
}

#[tauri::command]
async fn fetch_service_view(plan_id: Option<String>) -> Result<B1ServicePayload, String> {
    let client = get_client();

    let plans_url = format!("{}/doing/plans", B1_API_BASE);
    let plans_resp = client
        .get(&plans_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch plans: {}", e))?;

    if !plans_resp.status().is_success() {
        return Err(format!("Plans API returned status {}", plans_resp.status()));
    }

    let raw_plans: Vec<Value> = plans_resp.json().await.map_err(|e| e.to_string())?;
    if raw_plans.is_empty() {
        return Err("No service plans found in B1.church.".to_string());
    }

    let mut all_plans: Vec<B1PlanSummary> = raw_plans
        .into_iter()
        .map(|v| B1PlanSummary {
            id: v.get("id").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
            name: v.get("name").and_then(|x| x.as_str()).unwrap_or("Service Plan").to_string(),
            service_date: v.get("serviceDate").and_then(|x| x.as_str()).map(|s| s.to_string()),
        })
        .collect();

    // Sort plans from most recent to oldest (ISO 8601 date strings sort lexicographically)
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
        .send()
        .await
        .map_err(|e| format!("Failed to fetch plan items: {}", e))?;

    let raw_items: Vec<Value> = items_resp.json().await.map_err(|e| e.to_string())?;

    let mut raw_song_nodes = Vec::new();
    fn collect_song_nodes(nodes: &[Value], out: &mut Vec<(String, String, String)>) {
        for node in nodes {
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
        .map(|(plan_item_id, fallback_label, related_id)| async move {
            resolve_service_song(client, plan_item_id, fallback_label, related_id).await
        });

    let resolved = join_all(song_futures).await;
    let songs: Vec<B1ServiceSong> = resolved.into_iter().flatten().collect();

    Ok(B1ServicePayload {
        active_plan,
        all_plans,
        songs,
    })
}

async fn resolve_service_song(
    client: &reqwest::Client,
    plan_item_id: String,
    fallback_label: String,
    related_id: String,
) -> Option<B1ServiceSong> {
    let ak_url = format!("{}/content/arrangementKeys/{}", B1_API_BASE, related_id);
    // Keep empty string if no tone is specified so the frontend knows to fall back to Nashville
    let mut key_signature = String::new();
    let mut arrangement_id = String::new();

    if let Ok(resp) = client.get(&ak_url).send().await {
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
        client.get(&arr_url).send().await.ok()?.json().await.ok()?
    } else {
        let arr_url = format!("{}/content/arrangements/song/{}", B1_API_BASE, related_id);
        let list: Vec<Value> = client.get(&arr_url).send().await.ok()?.json().await.ok()?;
        list.into_iter().next()?
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
        if let Ok(resp) = client.get(&sd_url).send().await {
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
                // Only use songDetail key if arrangementKey didn't specify one
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
        .invoke_handler(tauri::generate_handler![fetch_service_view])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}