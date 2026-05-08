# Steps to Build a Stock Prediction Model

---

## Step 1: Define the Model Objective

Before writing any code, clearly define what you want the model to do:

- Price prediction? Trend prediction? Buy/sell signals?
Predecir el precio, ver el rango si entre 7 dias, un mes o unos meses o años, esto para ver las señanales de compras y asi
- What metrics will you use to evaluate success?
primero ver el que tanto predice bien los datos (esto incluyendo las noticias), tambien los moviminetos que te recomienda, esto verificarlo en que prediga a inicios de año y ver que me recomendo para ver si hubiera sido correcto
- What time horizon? (short-term, long-term)
Que pueda decidir en que tiempo las estrategias de compra o venta

**Expected Output:** A clear document or description of the objective.

---

## Step 2: Obtain the Data

Research where you can get data and in what format:

- Data sources: Market APIs (Yahoo Finance, Alpha Vantage, etc.)
   Opciones:
      yahoofinances para empezar
      Nasdaq Data Link
      alpha vintage
- Data types: Historical prices, volume, news, technical indicators

**Where to do:** `backend/data/preparation/`
**Where to save:** `backend/data/preparation/`

**Expected Output:** Raw data files in the dataset folder.

---

## Step 3: Clean and Prepare the Data

Convert raw data into something usable for the model.

### Tasks:

1. **Clean data**
   - Remove NaN values
   - Remove duplicates
   - Handle dates

2. **Create features (derived variables)**
   - Moving average
   - Returns
   - Volume
   - Technical indicators (RSI, MACD, etc.)

3. **Normalize data**
   - Scale values to the same range

4. **Create sequences** (if using LSTM)
   - Time windows (e.g., 30 days to predict the next)

**Expected Output:** Clean dataset ready for training in `data/03-final/` or similar.

---

## Step 4: Train the LSTM Model

Start with a simple LSTM model and adjust gradually.

### Tasks:

1. **Define model architecture**
   - LSTM layers
   - Dense layers
   - Loss function

2. **Train the model**
   - Split data into train/test
   - Tune hyperparameters

3. **Evaluate the model**
   - Metrics: accuracy, loss, MAE, RMSE

4. **Save the model**
   - Location: `backend/data/models/`

**Expected Output:** Trained and saved model.

---

## Next Steps (Future)

- Step 5: Improve the model (tune hyperparameters)
- Step 6: Add more data (news, sentiment analysis)
- Step 7: Deploy the model to production