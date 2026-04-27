import json
import pickle
import pandas as pd
import numpy as np
from scipy.sparse import csr_matrix
from sklearn.decomposition import TruncatedSVD

# --- 1. Загрузка данных ---
with open('synthetic_orders.json', 'r', encoding='utf-8') as f:
    orders_data = json.load(f)

with open('cleaned_menu.json', 'r', encoding='utf-8') as f:
    catalog_raw = json.load(f)

# Собираем словарь {id: name}
item_names = {}
if isinstance(catalog_raw, dict):
    for section in catalog_raw.values():
        for p in section.get('products', []):
            item_names[p['id']] = p['name']
else:
    for p in catalog_raw:
        item_names[p['id']] = p['name']

# --- 2. Подготовка DataFrame ---
df = pd.json_normalize(
    orders_data, 
    record_path=['products'], 
    meta=['user_id']
)

user_item_data = df.groupby(['user_id', 'product_id'])['quantity'].sum().reset_index()

# Создаем эффективный словарь истории покупок для фильтрации {user_id: set(product_ids)}
user_history = df.groupby('user_id')['product_id'].apply(set).to_dict()

user_ids = user_item_data['user_id'].astype("category")
item_ids = user_item_data['product_id'].astype("category")

conf_matrix = csr_matrix((
    user_item_data['quantity'].astype(float), 
    (user_ids.cat.codes, item_ids.cat.codes)
))

user_list = user_ids.cat.categories.tolist()
item_list = item_ids.cat.categories.tolist()

# --- 3. Обучение модели ---
print("Обучение модели...")
svd = TruncatedSVD(n_components=50, n_iter=15, random_state=42)
user_embeddings = svd.fit_transform(conf_matrix) 
item_embeddings = svd.components_.T           

# --- 4. Сохранение артефактов (Модели) локально ---
# Нам не обязательно сохранять сам объект svd, для инференса нужны только векторы и списки
model_artifacts = {
    'user_embeddings': user_embeddings,
    'item_embeddings': item_embeddings,
    'user_list': user_list,
    'item_list': item_list,
    'user_history': user_history
}

with open('recsys_model.pkl', 'wb') as f:
    pickle.dump(model_artifacts, f)
print("Модель и артефакты успешно сохранены в файл 'recsys_model.pkl'\n")

# --- 5. Функция рекомендаций ---
def get_recommendations(user_id, top_n=10):
    if user_id not in user_list:
        return "Пользователь не найден (Холодный старт)"
    
    user_idx = user_list.index(user_id)
    
    # Считаем предсказанные рейтинги
    scores = user_embeddings[user_idx].dot(item_embeddings.T)
    best_item_indices = np.argsort(scores)[::-1]
    
    # Достаем историю юзера за O(1) благодаря словарю
    already_bought = user_history.get(user_id, set())
    
    recs = []
    for idx in best_item_indices:
        product_id = item_list[idx]
        if product_id not in already_bought:
            name = item_names.get(product_id, f"ID: {product_id}")
            recs.append((name, round(scores[idx], 3)))
        
        if len(recs) == top_n:
            break
            
    return recs

# --- 6. Проверка для 5 юзеров ---
print("--- Тестирование рекомендаций ---")
# Берем первые 5 юзеров из списка
test_users = user_list[:5] 

for test_user in test_users:
    print(f"\nТоп-10 рекомендаций для пользователя {test_user}:")
    results = get_recommendations(test_user, top_n=10)
    
    if isinstance(results, str):
        print(results) # Выведет сообщение о холодном старте
    else:
        for i, (name, score) in enumerate(results, 1):
            print(f"{i}. {name} (score: {score})")