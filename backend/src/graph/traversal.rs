#![allow(dead_code)]

use std::collections::{HashMap, HashSet, VecDeque};
use uuid::Uuid;

use crate::models::Edge;

pub fn blast_radius_ids(start: Uuid, depth: usize, edges: &[Edge]) -> Vec<Uuid> {
    let mut adj: HashMap<Uuid, Vec<Uuid>> = HashMap::new();
    for e in edges {
        adj.entry(e.from_id).or_default().push(e.to_id);
    }
    bfs_limited(start, depth, &adj)
}

pub fn reverse_deps_ids(start: Uuid, depth: usize, edges: &[Edge]) -> Vec<Uuid> {
    let mut adj: HashMap<Uuid, Vec<Uuid>> = HashMap::new();
    for e in edges {
        adj.entry(e.to_id).or_default().push(e.from_id);
    }
    bfs_limited(start, depth, &adj)
}

fn bfs_limited(start: Uuid, depth: usize, adj: &HashMap<Uuid, Vec<Uuid>>) -> Vec<Uuid> {
    let mut out: Vec<Uuid> = Vec::new();
    let mut visited: HashSet<Uuid> = HashSet::new();
    let mut q: VecDeque<(Uuid, usize)> = VecDeque::new();

    visited.insert(start);
    q.push_back((start, 0));

    while let Some((cur, d)) = q.pop_front() {
        if d == depth {
            continue;
        }
        if let Some(nexts) = adj.get(&cur) {
            for &n in nexts {
                if visited.insert(n) {
                    out.push(n);
                    q.push_back((n, d + 1));
                }
            }
        }
    }

    out
}
