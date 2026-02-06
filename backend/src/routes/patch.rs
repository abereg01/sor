use serde_json::Value;

pub fn merge_patch(target: &mut Value, patch: &Value) {
    match patch {
        Value::Object(patch_map) => {
            if !target.is_object() {
                *target = Value::Object(serde_json::Map::new());
            }
            let target_map = target.as_object_mut().expect("must be object");

            for (k, v) in patch_map {
                if v.is_null() {
                    target_map.remove(k);
                } else {
                    match target_map.get_mut(k) {
                        Some(existing) => merge_patch(existing, v),
                        None => {
                            target_map.insert(k.clone(), v.clone());
                        }
                    }
                }
            }
        }
        _ => {
            *target = patch.clone();
        }
    }
}
