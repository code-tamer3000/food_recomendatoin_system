import json
import random
from datetime import datetime, timedelta

# --- 1. Настройки генератора ---
NUM_USERS = 500        # Количество уникальных пользователей
ORDERS_PER_USER = (2, 10) # От 2 до 10 заказов на пользователя
START_DATE = datetime(2023, 1, 1)
END_DATE = datetime(2024, 5, 1)

# --- 2. Загрузка и подготовка каталога ---
# --- 2. Загрузка и подготовка каталога ---
with open('cleaned_menu.json', 'r', encoding='utf-8') as f: # ИЛИ products_catalog.json
    raw_catalog = json.load(f)

categories = {}
products_dict = {}

# Универсальный парсер
# Вариант 1: Если это cleaned_menu.json (словарь словарей)
if isinstance(raw_catalog, dict):
    for section_key, section_data in raw_catalog.items():
        # Идем вглубь до списка products
        for item in section_data.get('products', []):
            cat = item['category_slug'] # Внимание: без int()!
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(item['id'])
            products_dict[item['id']] = item['price']

# Вариант 2: Если это первоначальный products_catalog.json (плоский список)
elif isinstance(raw_catalog, list):
    for item in raw_catalog:
        cat = item['category_slug'] # Внимание: без int()!
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(item['id'])
        products_dict[item['id']] = item['price']

# --- 3. Профили пользователей (Персоны) ---
USER_PERSONAS = ['pizza_lover', 'sushi_lover', 'party_maker', 'balanced']

def get_base_category_for_persona(persona):
    """Определяет основную категорию для старта заказа в зависимости от персоны"""
    if persona == 'pizza_lover':
        return random.choices(['pizza', 'street'], weights=[0.8, 0.2])[0]
    elif persona == 'sushi_lover':
        return random.choices(['rolly', 'sety', 'goryachee'], weights=[0.6, 0.3, 0.1])[0]
    elif persona == 'party_maker':
        return random.choices(['sety', 'pizza', 'zakuski'], weights=[0.5, 0.3, 0.2])[0]
    else: # balanced
        return random.choice(list(categories.keys()))

# --- 4. Логика генерации одного заказа ---
def generate_order(user_id, persona, order_id):
    products_in_order = {} # dict {product_id: quantity}
    
    # Выбираем основное блюдо
    base_cat = get_base_category_for_persona(persona)
    if base_cat in categories and categories[base_cat]:
        main_item = random.choice(categories[base_cat])
        products_in_order[main_item] = 1

    # Логика ДОПОЛНЕНИЙ (Ассоциативные правила)
    if base_cat in ['rolly', 'sety'] and 'dobawky' in categories:
        # К роллам часто берут соусы (васаби, соевый)
        if random.random() < 0.7: 
            addon = random.choice(categories['dobawky'])
            products_in_order[addon] = random.randint(1, 3) # Берут по 1-3 штуки
            
    if base_cat in ['pizza', 'street', 'sety'] and 'napitki' in categories:
        # К пицце или сетам часто берут напитки
        if random.random() < 0.6:
            drink = random.choice(categories['napitki'])
            products_in_order[drink] = random.randint(1, 2)

    # Случайный товар для "шума" и разнообразия (вероятность 20%)
    if random.random() < 0.2:
        random_cat = random.choice(list(categories.keys()))
        random_item = random.choice(categories[random_cat])
        products_in_order[random_item] = products_in_order.get(random_item, 0) + 1

    # Формируем итоговый список товаров для чека и считаем сумму
    final_products = []
    total_price = 0
    for pid, qty in products_in_order.items():
        price = products_dict[pid]
        final_products.append({
            "product_id": pid,
            "quantity": qty,
            "price": price
        })
        total_price += price * qty

    # Генерируем случайную дату
    random_days = random.randint(0, (END_DATE - START_DATE).days)
    random_seconds = random.randint(0, 86400)
    order_date = START_DATE + timedelta(days=random_days, seconds=random_seconds)

    return {
        "order_id": order_id,
        "user_id": user_id,
        "user_persona": persona, # Оставляем для аналитики
        "created_at": order_date.strftime("%Y-%m-%d %H:%M:%S"),
        "total_price": total_price,
        "products": final_products
    }

# --- 5. Генерация датасета ---
dataset = []
current_order_id = 10000

for user_id in range(1, NUM_USERS + 1):
    persona = random.choice(USER_PERSONAS)
    num_orders = random.randint(*ORDERS_PER_USER)
    
    for _ in range(num_orders):
        order = generate_order(user_id, persona, current_order_id)
        dataset.append(order)
        current_order_id += 1

# Сортируем датасет по времени (как в реальной базе)
dataset.sort(key=lambda x: x["created_at"])

# --- 6. Сохранение ---
with open('synthetic_orders.json', 'w', encoding='utf-8') as f:
    json.dump(dataset, f, ensure_ascii=False, indent=2)

print(f"Сгенерировано {len(dataset)} заказов для {NUM_USERS} пользователей.")
print("Файл сохранен как 'synthetic_orders.json'")