# Fundamentos Teóricos da Destilación

## Xemelgo dixital dun destilador con refluxo parcial — Material de apoio para alumnos

**Módulo:** Operacións Unitarias · **Tema:** Destilación
**Uso:** Documento de referencia para acompañar o simulador web (xemelgo dixital) do destilador con refluxo parcial.

---

## Índice

1. [Introdución e obxectivos](#1-introdución-e-obxectivos)
2. [A destilación como operación unitaria](#2-a-destilación-como-operación-unitaria)
3. [Usos e aplicacións industriais](#3-usos-e-aplicacións-industriais)
4. [Fundamentos termodinámicos do equilibrio líquido–vapor](#4-fundamentos-termodinámicos-do-equilibrio-líquido–vapor)
5. [Tipos de destilación](#5-tipos-de-destilación)
6. [Aparatos e equipos](#6-aparatos-e-equipos)
7. [Balances de materia](#7-balances-de-materia)
8. [Balances de enerxía](#8-balances-de-enerxía)
9. [Modelos matemáticos](#9-modelos-matemáticos)
10. [O xemelgo dixital do destilador](#10-o-xemelgo-dixital-do-destilador)
11. [Exemplo numérico resolto: benceno–tolueno](#11-exemplo-numérico-resolto-benceno–tolueno)
12. [Glosario](#12-glosario)
13. [Referencias](#13-referencias)
14. [Suxestións didácticas](#14-suxestións-didácticas)

---

## 1. Introdución e obxectivos

A **destilación** é a operación unitaria de separación máis utilizada na industria química, petroquímica, farmacéutica e de alimentos. Consiste en separar os compoñentes dunha mestura líquida aproveitando as **diferenzas de volatilidade** entre eles, mediante **vaporizacións e condensacións repetidas** en contracorrente dentro dunha columna.

Este material reúne o **background teórico** necesario para operar e interpretar o simulador web tipo *xemelgo dixital* dun **destilador continuo con refluxo parcial**. Ao finalizar o módulo o alumno será capaz de:

- Explicar por que a destilación é unha operación de **transferencia de masa** gobernada polo **equilibrio líquido–vapor (ELV)**.
- Calcular puntos de burbulla, orballo e composicións en equilibrio usando a lei de Raoult, Dalton e Antoine.
- Escribir os **balances de materia e enerxía** dunha columna e das súas seccións.
- Construír e interpretar o **método de McCabe–Thiele** (etapas teóricas, refluxo mínimo e total).
- Entender a estrutura dos **modelos matemáticos** (estacionarios MESH e dinámicos) que alimentan o xemelgo dixital.
- Manipular o simulador coma se operara unha planta real: cambiar refluxo, calor do refervedor, alimentación… e observar a resposta transitoria.

---

## 2. A destilación como operación unitaria

### 2.1 Que é unha operación unitaria?

As operacións unitarias son os **procesos físicos elementais** que, combinados, conforman calquera proceso químico industrial. Clasifícanse segundo o fenómeno de transporte dominante:

| Tipo | Exemplos |
|---|---|
| **Transferencia de masa** | Destilación, absorción, extracción, adsorción, secado, humidificación |
| **Transferencia de calor** | Intercambiadores, evaporadores, condensadores |
| **Transferencia de cantidade de movemento** | Bombeo, fluidización, sedimentación, filtración |
| **Operacións mecánicas** | Moenda, cribado, mestura |

### 2.2 Clasificación da destilación

A destilación pertence ás **operacións de transferencia de masa con cambio de fase**, xunto coa absorción e a extracción. A súa característica distintiva é que a separación se basea en **diferenzas de punto de ebulición (volatilidade)** e require **aporte e retirada de calor** (é enerxeticamente intensiva).

Segundo o seu modo de operación clasifícase en:

- **Continua** (alimentación e produtos fluen de forma permanente) vs. **descontinua ou por lotes (batch)**.
- **Simple** (unha soa etapa: flash, destilación diferencial) vs. **fraccionada ou rectificada** (múltiples etapas en columna).
- **Con refluxo** (parte do condensado regresa á columna) vs. **sen refluxo**.
- Segundo a presión: **atmosférica, ao baleiro** (compoñentes termicamente sensibles) e **a presión** (gases licuados).

> **Idea clave:** a columna de destilación é un *multiplicador de etapas de equilibrio*: en cada prato o vapor e o líquido póñense en contacto, achégans ao equilibrio e sepáranse, de modo que cada prato equivale aproximadamente a unha **etapa de equilibrio** que enriquece o vapor no compoñente máis volátil.

---

## 3. Usos e aplicacións industriais

| Sector | Aplicación típica |
|---|---|
| **Petróleo e gas** | Fraccionamento do cru en gasolina, queroseno, gasóleo, lubricantes; separación de GLP |
| **Petroquímica** | Separación benceno–tolueno–xileno (BTX), etileno–propileno (crioxénica), disolventes |
| **Química fina e farmacéutica** | Purificación de disolventes, recuperación de produtos, destilación ao baleiro de compostos termosensibles |
| **Alimentos e bebidas** | Produción de etanol, destilación de bebidas alcohólicas, aromas e aceites esenciais |
| **Crioxenia** | Separación do aire en O₂, N₂ e Ar |
| **Medio ambiente** | Recuperación de disolventes, tratamento de augas con compostos volátiles |
| **Biotecnoloxía** | Concentración de produtos de fermentación (bioetanol, bio-butanol) |

É a operación de separación dominante: estímase que a destilación representa unha fracción moi importante do **consumo enerxético** da industria de procesos (tipicamente o 40–60 % do gasto enerxético dunha refinaría). Por iso o deseño do **refluxo** e do **calor do refervedor** é un compromiso económico central.

---

## 4. Fundamentos termodinámicos do equilibrio líquido–vapor

A destilación apóiase nun feito termodinámico: cando un líquido e un vapor coexisten en equilibrio, **as composicións de ambas as dúas fases son distintas** (agás no azeótropo). O vapor é máis rico no compoñente máis volátil.

### 4.1 Composición de mesturas

Para unha mestura con $N_C$ compoñentes:

- **Fracción molar** do compoñente $i$ no líquido: $x_i = n_i^{L} / \sum_j n_j^{L}$, no vapor: $y_i$.
- Propiedades: $0 \le x_i \le 1$, $\sum_i x_i = 1$, $\sum_i y_i = 1$.
- Relación coa fracción máisica $w_i$: $x_i = \dfrac{w_i / PM_i}{\sum_j w_j / PM_j}$.

Nun sistema binario abonda cunha variable de composición por fase: $x_1 = x$, $x_2 = 1-x$ (análogo no vapor).

### 4.2 Presión de vapor e ecuación de Antoine

A volatilidade dun compoñente puro mídese pola súa **presión de vapor de saturación** $P_i^{sat}(T)$: a presión á que ferve a temperatura $T$. Correlaciónase coa **ecuación de Antoine** (en mmHg e °C):

$$
\log_{10} P_i^{sat}[\text{mmHg}] = A_i - \frac{B_i}{T[°C] + C_i}
$$

**Parámetros de Antoine** (para uso no simulador):

| Compoñente | A | B | C | Rango (°C) |
|---|---|---|---|---|
| Benceno | 6.90565 | 1211.033 | 220.790 | 8 – 103 |
| Tolueno | 6.95464 | 1344.800 | 219.482 | 6 – 136 |
| Etanol | 8.20417 | 1642.890 | 230.300 | −3 – 96 |
| Metanol | 8.08097 | 1582.271 | 239.726 | −16 – 91 |
| Auga | 8.07131 | 1730.630 | 233.426 | 1 – 100 |

> **Nota para o xemelgo dixital:** o simulador debe incluír Antoine para cada compoñente e resolver $T$ por iteración (punto de burbulla/orballo). Se se usan presións distintas de 1 atm, a presión total $P$ entra nas ecuacións de equilibrio.

### 4.3 Equilibrio líquido–vapor ideal: Raoult e Dalton

Para mesturas ideais (benceno–tolueno, por exemplo), o equilibrio descríbese combinando:

- **Lei de Raoult** (fase líquida ideal): $p_i = x_i \, P_i^{sat}(T)$
- **Lei de Dalton** (fase vapor ideal): $p_i = y_i \, P$

Igualando presións parciais:

$$
y_i P = x_i \, P_i^{sat}(T) \qquad\Longrightarrow\qquad y_i = \frac{x_i \, P_i^{sat}(T)}{P}
$$

**Condición de equilibrio (suma de presións parciais):**

$$
\sum_i y_i = \frac{1}{P}\sum_i x_i \, P_i^{sat}(T) = 1
$$

Esta ecuación define a temperatura de burbulla a $P$ dada. O cociente

$$
K_i = \frac{y_i}{x_i} = \frac{P_i^{sat}(T)}{P}
$$

é a **constante de equilibrio** (valor K): $K_i > 1$ → o compoñente tende a concentrarse no vapor; $K_i < 1$ → no líquido.

### 4.4 Diagramas T–xy e x–y

Para un binario ideal a presión constante:

- **Curva de burbulla** (T–x): temperatura á que a mestura líquida de composición $x$ comeza a ferver.
- **Curva de orballo** (T–y): temperatura á que o vapor de composición $y$ comeza a condensar.
- **Diagrama de equilibrio x–y**: representa $y$ vs. $x$ a presión constante; canto máis se afasta a curva da diagonal ($y=x$), máis fácil é a separación.

```
T (°C)                 y (fracción molar en vapor)
  |                      1.0 |  •——————— (x=y diagonal)
  |  orballo (T–y)           |      /
  |  ················        |     /   curva de equilibrio
  |  :              :       |    /    y = f(x)
  |  :   burbulla   :       |   /
  |  :  (T–x)       :      |  /
  |  ················       | /
  |______________________   |/____________________
    0     x        1         0         x         1
```

A distancia vertical entre burbulla e orballo é a **zona de dúas fases**: a unha temperatura dada, líquido de composición $x_L$ e vapor de composición $y_V$ coexisten (regra da panca para as súas cantidades relativas).

### 4.5 Volatilidade relativa

Defínese a **volatilidade relativa** entre dous compoñentes como

$$
\alpha_{ij} = \frac{K_i}{K_j} = \frac{y_i/x_i}{y_j/x_j}
$$

Para un sistema ideal, $\alpha_{ij} = P_i^{sat}/P_j^{sat}$ (depende débilmente de $T$). Para un binario con $\alpha$ aproximadamente constante:

$$
\boxed{y = \frac{\alpha x}{1 + (\alpha - 1)x}}
$$

Esta única ecuación substitúe o par de curvas burbulla–orballo e é a base do método gráfico de McCabe–Thiele. Canto maior é $\alpha$, máis separada está a curva de equilibrio da diagonal e **menos etapas** se necesitan.

### 4.6 Desviacións da idealidade e azeótropos

Moitas mesturas industriais (etanol–auga, acetona–cloroformo) **non** cumpren Raoult. Corríxese co **coeficiente de actividade** $\gamma_i$:

$$
y_i P = \gamma_i(x_i, T) \, x_i \, P_i^{sat}(T)
$$

Os $\gamma_i$ estímanse con modelos de enerxía de Gibbs en exceso: **Wilson, NRTL, UNIQUAC** (e van Laar / Margules para binarios simples). Os seus parámetros proveñen de datos experimentais.

**Azeótropo:** composición na que $x_i = y_i$ (a curva de equilibrio corta a diagonal). A esa composición a mestura ferve a temperatura constante coma se fose un compoñente puro e **non pode separarse por destilación simple**. Para romper o azeótropo úsanse destilación **azeotrópica** (axente de arrastre) ou **extractiva** (disolvente pesado), ou cambios de presión (azeótropos sensibles á presión).

### 4.7 Punto de burbulla e punto de orballo

Son os cálculos termodinámicos elementais que todo modelo de columna executa en cada etapa:

- **Burbulla** (dados $P$ e $x_i$): atopar $T$ tal que $\sum_i x_i P_i^{sat}(T) = P$; logo $y_i = x_i P_i^{sat}(T)/P$.
- **Orballo** (dados $P$ e $y_i$): atopar $T$ tal que $\sum_i y_i / P_i^{sat}(T) = 1/P$; logo $x_i = y_i P / P_i^{sat}(T)$.
- **Flash** (dados $P$, $T$ e composición global $z_i$): resolver a fracción vaporizada $\psi$ coa ecuación de Rachford–Rice: $\sum_i \dfrac{z_i (K_i - 1)}{1 + \psi (K_i - 1)} = 0$.

> **Implementación numérica (xemelgo dixital):** o punto de burbulla resólvese por bisección ou secante sobre $T$ (3–6 iteracións abondan). O flash require ademais iteración sobre $\psi$. Estas subrutinas chámanse decenas de veces por paso de integración nun modelo dinámico: deben ser rápidas e robustas.

---

## 5. Tipos de destilación

### 5.1 Destilación flash (de equilibrio)

Unha soa etapa: a alimentación vaporízase parcialmente (válvula de expansión ou quentador) e sepáranse líquido e vapor nun tambor. O seu balance (caso binario):

$$
F = V + L, \qquad F z = V y + L x, \qquad y = \frac{\alpha x}{1+(\alpha-1)x}
$$

### 5.2 Destilación diferencial (batch, ecuación de Rayleigh)

Férvese un lote e o vapor retírase continuamente; a composición do residuo cambia co tempo:

$$
\ln \frac{W_0}{W} = \int_{x}^{x_0} \frac{dx}{y^* - x}
$$

Para $\alpha$ constante: $\ln \dfrac{W_0}{W} = \dfrac{1}{\alpha - 1}\ln\dfrac{x_0(1-x)}{x(1-x_0)} + \ln\dfrac{1-x}{1-x_0}$.

### 5.3 Destilación continua fraccionada (columna)

É a configuración do xemelgo dixital: alimentación continua, dous produtos, **sección de enriquecemento (rectificación)**, **sección de esgotamento**, condensador e refervedor. O refluxo de líquido devolto á columna é o que permite alcanzar alta pureza no destilado.

### 5.4 Destilación por lotes con refluxo (rectificación batch)

Similar á continua pero con carga finita; a composición do destilado varía co tempo. Útil en plantas multipropósito. O xemelgo dixital pode estenderse a este modo nunha fase posterior.

### 5.5 Destilación con refluxo parcial (o noso caso de estudo)

Nun **condensador total** todo o vapor condénsase e o líquido divídese entre **refluxo** $L_0$ (volve á columna) e **destilado** $D$ (produto).

Nun **condensador parcial**, só unha parte do vapor se condensa:

- O **vapor non condensado é o produto destilado** (ou condénsase á parte).
- O **líquido condensado é o refluxo** que regresa á columna.
- O condensador parcial actúa como **unha etapa de equilibrio adicional**: o vapor de saída está en equilibrio co refluxo líquido á temperatura do condensador.

A **relación de refluxo** defínese igual: $R = L_0/D$, pero agora $D$ é fluxo de vapor (molar). No simulador veremos que aumentar $R$:

1. Aumenta o **grao de separación** (máis etapas equivalentes, destilado máis puro),
2. pero esixe **máis calor de refervedor e máis condensación** (máis enerxía e menor capacidade).

*Refluxo total* ($D=0$, $R\to\infty$): máxima separación posible coa columna dada (etapas mínimas). *Refluxo mínimo* ($R_{min}$): infinitas etapas para a separación pedida. O refluxo de operación escóllese tipicamente $R = (1.2\text{–}1.5)\,R_{min}$ como compromiso.

### 5.6 Outras variantes

- **Ao baleiro / molecular**: reduce $T$ para compostos termosensibles.
- **Azeotrópica e extractiva**: con terceiro compoñente para romper azeótropos.
- **Reactiva**: reacción química e separación simultáneas na columna.
- **Crioxénica**: a moi baixa $T$ e alta $P$ (separación do aire).
- **Con arrastre de vapor (steam stripping)**: vapor directo como axente de quentamento.

---

## 6. Aparatos e equipos

### 6.1 Columna de pratos

Conxunto de etapas discretas (pratos/bandexas) onde vapor e líquido se contactan en **contracorrente**:

```
                    ┌─────────────────────┐
   refluxo L_0 ────►│   CONDENSADOR       │◄── vapor V_1
                    │   (total ou parcial)│
                    └──────────┬──────────┘
                               │ destilado D
      ┌────────────────────────┴───────────┐
      │        ZONA DE ENRIQUECEMENTO       │  pratos 1..f−1
      │   (o vapor sube, o líquido baixa)   │
      └────────────────────────┬───────────┘
          alimentación F, z ──►┴  (prato de alimentación f)
      ┌────────────────────────┬───────────┐
      │        ZONA DE ESGOTAMENTO          │  pratos f+1..N
      └────────────────────────┬───────────┘
                               │ líquido L_N
      ┌────────────────────────┴───────────┐
      │        REFERVEDOR                  │◄── calor Q_R
      └────────────────────────┬───────────┘
                               │ fondos B, x_B
```

- **Pratos de campá (burbullamento), de válvula e perforados (sieve):** o vapor burbulla a través do líquido retido sobre o prato (vertedoiro). A maior retención (holdup) de líquido, maior estabilidade pero máis inventario (importante en dinámica).
- **Eficiencia de prato (Murphree):** $E_{MV} = \dfrac{y_n - y_{n+1}}{y_n^* - y_{n+1}}$; relaciona as etapas **reais** coas **teóricas** ($N_{real} = N_{\text{teóricas}}/E_0$ coa eficiencia global $E_0$).

### 6.2 Columnas con recheo

No canto de pratos usan **recheo aleatorio** (aneis Raschig, selas Berl, Pall) ou **estruturado** (mallas metálicas). O contacto é continuo; o deseño faise con **unidades de transferencia** (HTU–NTU) ou con modelos *rate-based*. Preferidas para baleiro, corrosión e diámetros pequenos.

### 6.3 Refervedor

Proporciona o **vapor de fondo** (o "motor" da columna):

- **Kettle:** baño de ebulición con cámara de vapor; simple, estable.
- **Termosifón (horizontal ou vertical):** circulación natural por diferenza de densidades; moi usado.
- **Circulación forzada:** bomba; para líquidos viscosos ou sucios.
- **De lume directo:** caldeira tipo forno (refinarías).

No modelo: $Q_R$ fixa o fluxo de vapor $V_R \approx Q_R / \lambda$ (con $\lambda$ = calor latente medio). É a **variable de manipulación** principal da temperatura de fondos.

### 6.4 Condensador

- **Total:** condensa todo o vapor $V_1$; o líquido divídese en refluxo $L_0$ e destilado $D$. Non achega etapa de separación.
- **Parcial:** condensa só o refluxo; o **destilado sae como vapor** e o condensador equivale a **unha etapa de equilibrio adicional** (o vapor de saída está en equilibrio co líquido de refluxo). É a configuración que simula o noso xemelgo dixital.

O calor retirado: $Q_C = V_1 (H_1^{vap} - h_D^{liq})$ (total) ou $Q_C = L_0 (H_1^{vap} - h_0^{liq})$ (parcial).

### 6.5 Acumulador de refluxo e divisor de refluxo

- **Acumulador (reflux drum):** recipiente que recibe o condensado e amortigua as variacións; o seu nivel contrólase coa saída.
- **Divisor de refluxo:** válvula ou divisor que reparte o condensado entre $L_0$ e $D$; no xemelgo dixital é o **actuador da relación de refluxo** $R = L_0/D$.

### 6.6 Instrumentación e actuadores (clave para o xemelgo dixital)

| Variable | Sensor típico | Uso |
|---|---|---|
| Temperatura | Termopar / RTD (pratos, fondos, cabeza) | Inferencia de composición (prato sensible) |
| Presión | Transmisor de presión | Control de presión de columna |
| Cabal | Placa de orificio / máisico (Coriolis) | F, L₀, D, B, V |
| Nivel | Diferencial de presión / radar | Acumulador e fondo |
| Composición | GC, NIR, densidade | Verificación (e calibración do modelo) |
| Calor | Consigna á caldeira / vapor de calefacción | Q_R |

Na aula, o xemelgo dixital **substitúe os sensores reais polos valores do modelo**, pero a lóxica de control (lazos PID, esquemas L/D, R/V, D/V) é idéntica á de planta real.

---

## 7. Balances de materia

### 7.1 Balance global e por compoñente

Para a columna completa (estado estacionario):

$$
F = D + B \qquad\qquad F\, z_F = D\, x_D + B\, x_B
$$

Despexando (ecuación clave de deseño):

$$
\frac{D}{F} = \frac{z_F - x_B}{x_D - x_B}, \qquad \frac{B}{F} = \frac{x_D - z_F}{x_D - x_B}
$$

### 7.2 Relación de refluxo

$$
R = \frac{L_0}{D}
$$

e na sección de enriquecemento (con fluxo molar constante): $V = L + D = (R+1)D$.

### 7.3 Liñas de operación

Balanceando a sección de **enriquecemento** (envolvente por riba do prato $n$):

$$
\boxed{y_{n+1} = \frac{R}{R+1}\, x_n + \frac{x_D}{R+1}}
$$

Liña recta no diagrama x–y: pendente $R/(R+1)$, ordenada na orixe $x_D/(R+1)$, e pasa polo punto $(x_D, x_D)$ da diagonal.

Balanceando a sección de **esgotamento** (envolvente por debaixo do prato $m$):

$$
\boxed{\bar{y}_{m+1} = \frac{\bar{L}}{\bar{V}}\, \bar{x}_m - \frac{B}{\bar{V}}\, x_B}
$$

onde $\bar{L}$ e $\bar{V}$ son os fluxos molares na sección de esgotamento. Pasa por $(x_B, x_B)$.

### 7.4 Liña de alimentación (liña q)

O estado térmico da alimentación cambia os fluxos internos: $q$ é a fracción de alimento que entra como **líquido** ($q=1$: líquido saturado; $q=0$: vapor saturado; $0<q<1$: mestura; $q<0$: vapor sobrequentado; $q>1$: líquido subarrefriado).

$$
q = \frac{\bar{L} - L}{F} = \frac{h_V - h_F}{h_V - h_L}
\qquad\Longrightarrow\qquad
\boxed{y = \frac{q}{q-1}\, x - \frac{z_F}{q-1}}
$$

A liña q corta as dúas liñas de operación no punto de intersección; a súa posición determina o **prato óptimo de alimentación** (o escalón de McCabe–Thiele debe cambiar de liña de operación no escalón que cruza a liña q).

### 7.5 Refluxo mínimo, refluxo total e refluxo óptimo

- **Refluxo total ($R\to\infty$):** as liñas de operación coinciden coa diagonal; número mínimo de etapas, dado por **Fenske**:

$$
N_{min} = \frac{\ln\left[\left(\dfrac{x_D}{1-x_D}\right)\left(\dfrac{1-x_B}{x_B}\right)\right]}{\ln \alpha}
$$

- **Refluxo mínimo:** as liñas de operación e a liña q córtanse **sobre a curva de equilibrio** (punto de pinzamento); necesítanse infinitas etapas. Para q=1 e binario con $\alpha$ cte.: $R_{min} = \dfrac{x_D - y^*}{y^* - x^*}$ con $x^*=z_F$, $y^*=\alpha x^*/(1+(\alpha-1)x^*)$.
- **Refluxo de operación:** $R = (1.2\text{–}1.5)\,R_{min}$. A **correlación de Gilliland / Eduljee** estima as etapas reais:

$$
Y = 1 - \exp\!\left[\frac{1+54.4X}{11+117.2X}\cdot\frac{X-1}{\sqrt{X}}\right], \qquad X=\frac{R-R_{min}}{R+1},\quad Y=\frac{N-N_{min}}{N+1}
$$

---

## 8. Balances de enerxía

### 8.1 Entalpías e calor latente

Cada corrente transporta entalpía: líquido $h(T,x)$, vapor $H(T,y) = h + \lambda(T,y)$. O **calor latente** $\lambda$ (kJ/kmol) domina o balance: condensar ou vaporizar 1 kmol custa aproximadamente $\lambda$ (≈ 30–40 MJ/kmol para hidrocarburos lixeiros; a auga ≈ 40.7 MJ/kmol).

### 8.2 Balance no condensador

Condensador total (todo o vapor $V_1=(R+1)D$ condénsase):

$$
Q_C = V_1\, H_1 - (L_0 + D)\, h_D = (R+1)D\,\bigl(H_1 - h_D\bigr)
$$

Condensador parcial (só o refluxo condensa):

$$
Q_C = L_0\,\bigl(H_1^{vap} - h_0^{liq}\bigr)
$$

### 8.3 Balance no refervedor

$$
Q_R = V_R\, H_V^{reb} + B\, h_B - L_N\, h_N
$$

Na práctica (refervedor kettle, fondos a ebulición): $Q_R \approx V_R\,\lambda_{avg}$.

### 8.4 Hipótese de fluxo molar constante (McCabe–Thiele)

O método gráfico clásico supón:

1. Calores latentes molares **iguais** para ambos os dous compoñentes,
2. **sen calor de mestura** (mestura ideal),
3. **sen perdas de calor**,
4. presións e entalpías dos líquidos saturados practicamente iguais.

Con estas hipóteses, $L$, $V$, $\bar L$, $\bar V$ son **constantes por sección** e o balance de enerxía redúcese a un balance de materia en moles. É válido para sistemas ideais (benceno–tolueno) e é o modelo base do simulador didáctico.

### 8.5 Método rigoroso: Ponchon–Savarit

Cando o calor latente difire entre compoñentes ou hai calor de mestura, débese traballar no **diagrama entalpía–composición (H–x,y)**: cada liña de operación substitúese por un **polo** (punto de diferenza de fluxo) e as etapas escalónanse entre a curva de entalpía do líquido e a do vapor. Máis preciso, pero máis complexo de implementar; o xemelgo dixital pode ofrecelo como opción "avanzada".

---

## 9. Modelos matemáticos

Aquí está o corazón do xemelgo dixital: o conxunto de ecuacións que, resolto numericamente, reproduce o comportamento da columna.

### 9.1 Modelo de equilibrio por etapas en estado estacionario (ecuacións MESH)

Para cada etapa $j$ (pratos, condensador, refervedor) e cada compoñente $i$:

- **M (balances de materia):** $L_{j-1} x_{j-1,i} + V_{j+1} y_{j+1,i} + F_j z_{j,i} - L_j x_{j,i} - V_j y_{j,i} = 0$
- **E (equilibrio):** $y_{j,i} = K_{j,i}(T_j,P_j,\mathbf{x}_j)\, x_{j,i}$
- **S (sumatorias):** $\sum_i x_{j,i} = 1$, $\sum_i y_{j,i} = 1$
- **H (balances de enerxía):** $L_{j-1} h_{j-1} + V_{j+1} H_{j+1} + F_j h_{F_j} - L_j h_j - V_j H_j \pm Q_j = 0$

**Resolución:** o sistema é grande e non lineal. Métodos estándar:

- **Burbulla (bubble-point):** iterar prato a prato resolvendo o punto de burbulla en cada etapa e a matriz tridiagonal dos balances de materia (método de Thomas) para as $x_{j,i}$, actualizando $T_j$ e $V_j$.
- **Newton–Raphson simultáneo:** sobre todas as variables ($x$, $y$, $T$, $V$) con matriz xacobiana; robusto pero custoso.
- **Métodos inside-out** (de dobre bucle): os usados por Aspen/HYSYS; o bucle interno actualiza $K$ e entalpías con correlacións simples, o externo recalcula os parámetros rigorosos.

### 9.2 Método de McCabe–Thiele (binario, ideal)

Procedemento gráfico que resolve implicitamente o modelo MESH para sistemas binarios con fluxo molar constante:

1. Debuxar a **curva de equilibrio** $y = \alpha x/[1+(\alpha-1)x]$ e a diagonal.
2. Debuxar a **liña q** e as **liñas de operación** de ambas as dúas seccións.
3. **Escalonar** entre a curva de equilibrio e as liñas de operación, empezando en $(x_D, x_D)$ e terminando ao cruzar $(x_B, x_B)$. Cada escalón completo = **unha etapa teórica** (o último inclúe o refervedor).
4. Cambiar de liña de operación no escalón que cruza a liña q (prato de alimentación óptimo).

Resultados: número de etapas teóricas $N_{PS}$, prato de alimentación, e sensibilidade a $R$ (máis refluxo → menos etapas pero máis enerxía).

### 9.3 Modelos dinámicos (para o xemelgo dixital)

Na operación real a columna **non** está en estado estacionario: arranques, cambios de consigna, perturbacións. O xemelgo dixital resolve o modelo dinámico por etapas:

**Balance de materia dinámico no prato $j$ (compoñente $i$):**

$$
\frac{d}{dt}\bigl(M_j x_{j,i}\bigr) = L_{j-1} x_{j-1,i} + V_{j+1} y_{j+1,i} + F_j z_{j,i} - L_j x_{j,i} - V_j y_{j,i}
$$

**Balance total no prato $j$:**

$$
\frac{dM_j}{dt} = L_{j-1} + V_{j+1} + F_j - L_j - V_j
$$

**Balance de enerxía no prato $j$:**

$$
\frac{d}{dt}\bigl(M_j h_j\bigr) = L_{j-1} h_{j-1} + V_{j+1} H_{j+1} + F_j h_{F_j} - L_j h_j - V_j H_j \pm Q_j
$$

**Equilibrio (instantáneo, cada etapa):** $y_{j,i} = K_{j,i} x_{j,i}$ con punto de burbulla para $T_j$.

**Condensador parcial (o noso caso):**

$$
\frac{d}{dt}\bigl(M_C x_{C,i}\bigr) = V_1 y_{1,i} - L_0 x_{C,i} - D\, y_{C,i}
$$

O vapor de destilado $D$ está en equilibrio co refluxo $L_0$ (etapa adicional), e a **relación de refluxo** $R = L_0/D$ é manipulada polo divisor.

**Refervedor (kettle):**

$$
\frac{d}{dt}\bigl(M_R x_{R,i}\bigr) = L_N x_{N,i} - B x_{R,i} - V_R y_{R,i}, \qquad V_R \approx \frac{Q_R}{\lambda}
$$

### 9.4 Hidráulica de pratos e caída de presión

Para que a simulación sexa realista, os fluxos $L_j$ e $V_j$ non son simplemente constantes:

- **Fluxo de líquido sobre o vertedoiro (correlación de Francis):** $L_j = k\, \rho\, l_w\, h_{ow}^{3/2}$ (o holdup $M_j$ e a altura de crista $h_{ow}$ relaciónanse co nivel do prato).
- **Caída de presión por prato:** $\Delta P_j = \Delta P_{\text{seco}} + \Delta P_{\text{hidrostático}} + \Delta P_{\text{residual}}$; a presión da columna aumenta cara ao fondo.
- **Vapor:** $V_j$ depende do gradiente de presión e da apertura de pratos/válvulas.

Estas correlacións engaden **atrasos e inercia** que fan o transitorio do simulador moito máis fiel á planta real.

### 9.5 Modelos rate-based

No canto de supoñer etapas en equilibrio, resólvense os **fluxos de transferencia de masa e calor** con coeficientes de transporte (películas líquida e vapor) e área interfacial. Máis rigoroso para columnas con recheo e non-equilibrio; menciónase aquí como nivel "avanzado" (Aspen Rate-Based), non necesario para o xemelgo didáctico.

### 9.6 Estratexias numéricas para o simulador web

| Tarefa | Método recomendado |
|---|---|
| Punto de burbulla/orballo | Bisección ou secante sobre $T$ (rápido e estable) |
| Flash | Iteración de Rachford–Rice + Newton |
| Estado estacionario (deseño) | McCabe–Thiele ou resolución do sistema MESH (Newton) |
| Dinámica (ODE) | **RK4** con paso adaptativo; se o sistema é ríxido (pratos con holdup pequeno e tempos de transporte curtos), usar **Euler implícito** ou BDF |
| Rixidez | Comparar constantes de tempo: prato (segundos–minutos) vs. acumulador/refervedor (minutos) |
| Validación | Comparar con caso estacionario coñecido (ex. benceno–tolueno) e con balances globais |

O xemelgo dixital executa o modelo dinámico **en tempo real ou acelerado** ($N\times$), gardando series temporais para que o alumno vexa a evolución de temperaturas, composicións e cabais.

### 9.7 Control da columna

Unha columna típica ten **5 lazos básicos**:

| Lazo | Variable medida | Variable manipulada |
|---|---|---|
| Presión | $P$ de columna | Retirada de calor do condensador / vent de non condensables |
| Nivel de acumulador | Nivel do tambor de refluxo | Destilado $D$ |
| Nivel de fondos | Nivel do refervedor | Fondos $B$ |
| Composición ou temperatura | $T$ de prato sensible (ou composición) | Refluxo $L_0$ (ou $Q_R$) |
| Calor | $Q_R$ (caldeira) | Vapor de calefacción |

Os **esquemas de control** máis comúns: **L/D** (refluxo fixo, destilado controla o nivel), **R/V** (relación refluxo–vapor), **D/V**, **L/V**… O xemelgo dixital debe permitir **conmutar esquemas** e **sintonizar PID**, igual que en planta.

---

## 10. O xemelgo dixital do destilador

### 10.1 Concepto

Un **xemelgo dixital (digital twin)** é unha **réplica virtual viva** dun sistema físico: recibe datos (sensores ou simulados), executa un modelo matemático en tempo real, e permite **predecir, diagnosticar e adestrar** sen tocar a planta.

Na aula, o noso xemelgo dixital do destilador con refluxo parcial:

- **Modela** a columna coas ecuacións das seccións 7–9 (balances, ELV, dinámica).
- **Visualiza** en tempo real: perfil de temperatura, perfil de composición, cabais, niveis, diagrama x–y co escalonado de McCabe–Thiele.
- **Permite manipular** $R$, $Q_R$, $F$, $z_F$, estado térmico da alimentación, consignas de control.
- **Rexistra** series temporais e permite reproducir perturbacións (cambios de composición de alimento, perda de vapor de calefacción, etc.).

### 10.2 Arquitectura proposta

```
┌─────────────────────────────── XEMELGO DIXITAL ──────────────────────────────┐
│                                                                             │
│   ┌──────────────┐   consignas    ┌──────────────────────┐                  │
│   │  INTERFAZ    │ ─────────────► │   MOTOR DE           │                  │
│   │  WEB (UI)    │                │   SIMULACIÓN         │                  │
│   │  · controis  │ ◄───────────── │  · modelo dinámico   │                  │
│   │  · gráficos  │   estados      │    por etapas (ODE)  │                  │
│   │  · diagramas │   (T, x, y,    │  · ELV: Antoine/     │                  │
│   │  · P&ID      │    fluxos,     │    Raoult/Ki         │                  │
│   └──────────────┘    niveis)     │  · integrador RK4    │                  │
│         ▲                         │  · control PID       │                  │
│         │                         └──────────┬───────────┘                  │
│         │            series temporais       │                              │
│         └───────────────┬────────────────────┘                              │
│                         ▼                                                   │
│              ┌─────────────────────┐                                        │
│              │  HISTÓRICO / DATOS  │  (opcional: alimentar con sensores     │
│              │  (simulados ou reais)│  reais dunha planta piloto)           │
│              └─────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

Compoñentes suxeridos para a implementación:

1. **Núcleo de cálculo (JavaScript/TypeScript ou WebAssembly):** Antoine, punto de burbulla/orballo, modelo de pratos, integrador RK4. Debe correr no navegador.
2. **UI:** controis deslizantes (R, Q_R, F, z_F), botóns de perturbación, panel de instrumentos (indicadores), e **gráficos en tempo real** (perfís, series temporais, diagrama x–y).
3. **Persistencia:** exportar/importar escenarios (JSON), rexistro de sesións de alumnos.
4. **Modo xemelgo:** sincronizar o modelo cun "proceso" simulado ruidoso (ou sensores reais), de modo que o alumno **identifique e corrixa desviacións** — é dicir, que actúe como operador de planta.

### 10.3 Do modelo á simulación interactiva

Pasos de implementación (seguirémolos nas seguintes fases do proxecto):

1. Termodinámica e ELV (funcións puras, probables).
2. Modelo estacionario McCabe–Thiele (validación de deseño).
3. Modelo dinámico por etapas + integrador.
4. Control PID e esquemas de refluxo.
5. Interfaz web con visualización en tempo real.
6. Escenarios didácticos e avaliación do alumno (que pasa se…).

---

## 11. Exemplo numérico resolto: benceno–tolueno

Sistema **ideal** (Raoult válido), $P = 1\ \text{atm} = 760\ \text{mmHg}$. Benceno = compoñente máis volátil (1).

**Datos:** $z_F = 0.50$ (fracción molar de benceno), $x_D = 0.95$, $x_B = 0.05$, alimentación líquido saturado ($q=1$), $F = 100\ \text{kmol/h}$.

### 11.1 Punto de burbulla e orballo

**Burbulla** ($x=0.5$): buscar $T$ con $0.5\,P_B^{sat}(T) + 0.5\,P_T^{sat}(T) = 760$.

| T (°C) | $P_B^{sat}$ (mmHg) | $P_T^{sat}$ (mmHg) | Σ x·P^sat |
|---|---|---|---|
| 90.0 | 1021 | 406.9 | 713.9 |
| 92.0 | 1081 | 433.8 | **757.4** ≈ 760 |
| 93.0 | 1112 | 447.8 | 779.9 |

→ **$T_{burbulla}$ ≈ 92.0 °C**; vapor en equilibrio: $y = \dfrac{0.5 \times 1081}{760} = 0.711$.

**Orballo** ($y=0.5$): buscar $T$ con $\dfrac{1}{P} = \dfrac{0.5}{P_B^{sat}} + \dfrac{0.5}{P_T^{sat}}$.

→ **$T_{\text{orballo}}$ ≈ 98.8 °C** (verifícase: a 98.8 °C, $P_B^{sat}\approx 1307$, $P_T^{sat}\approx 535$; $0.5/1307 + 0.5/535 = 1/758.5 \approx 1/760$).

**Volatilidade relativa:** $\alpha = \dfrac{P_B^{sat}}{P_T^{sat}} \approx \dfrac{1081}{434} \approx 2.49$ (a 92 °C). Tomaremos **α ≈ 2.5** como constante.

### 11.2 Balances de materia (columna completa)

$$
\frac{D}{F} = \frac{z_F - x_B}{x_D - x_B} = \frac{0.50 - 0.05}{0.95 - 0.05} = 0.50
$$

Con $F = 100$ kmol/h: **$D = 50$ kmol/h, $B = 50$ kmol/h**.

### 11.3 Refluxo mínimo e de operación

$q=1$ → liña q vertical en $x = z_F = 0.50$. Na curva de equilibrio: $y^* = \dfrac{2.5 \times 0.5}{1 + 1.5 \times 0.5} = 0.7143$.

Pendente da liña de enriquecemento no pinzamento: $\dfrac{0.95 - 0.7143}{0.95 - 0.50} = 0.5237$ → $R_{min} = \dfrac{0.5237}{1-0.5237} = 1.10$.

**Refluxo de operación:** $R = 1.5\,R_{min} \approx 1.65$.

### 11.4 McCabe–Thiele

- **Liña de enriquecemento:** $y = \dfrac{1.65}{2.65}\,x + \dfrac{0.95}{2.65} = 0.6226\,x + 0.3585$
- **Liña q:** $x = 0.5$ (vertical)
- **Intersección (enriquecemento–q):** $(0.5,\ 0.6891)$ → a liña de esgotamento pasa por $(0.05,0.05)$ e $(0.5,0.6891)$: $y = 1.4202\,x - 0.0210$

**Escalonado** (cada fila = unha etapa teórica; composición do líquido do prato $x_j$ e vapor que sobe $y_{j+1}$):

| Etapa | $x_j$ (líquido) | $y_{j+1}$ (vapor) | Zona |
|---|---|---|---|
| 1 | 0.884 | 0.909 | Enriquecemento |
| 2 | 0.799 | 0.856 | Enriquecemento |
| 3 | 0.704 | 0.797 | Enriquecemento |
| 4 | 0.611 | 0.739 | Enriquecemento |
| 5 (alimentación) | 0.531 | 0.689 | Cambio de liña |
| 6 | 0.470 | 0.647 | Esgotamento |
| 7 | 0.423 | 0.579 | Esgotamento |
| 8 | 0.355 | 0.483 | Esgotamento |
| 9 | 0.272 | 0.365 | Esgotamento |
| 10 | 0.187 | 0.245 | Esgotamento |
| 11 | 0.115 | 0.142 | Esgotamento |
| 12 | 0.062 | 0.067 | Esgotamento |
| 13 (refervedor) | 0.028 ≤ x_B | — | Esgotamento |

**Resultado:** $N_{PS} \approx 13$ **etapas teóricas incluíndo o refervedor** (12 pratos + refervedor), con alimentación no prato 5. Con eficiencia global $E_0 \approx 0.7$ → ≈ **18 pratos reais**.

**Verificación con correlacións:**
- Fenske (refluxo total): $N_{min} = \dfrac{\ln(19 \times 19)}{\ln 2.5} = 6.4$ etapas.
- Gilliland–Eduljee con $R=1.65$: $X = 0.2075$ → $Y = 0.454$ → $N \approx 12.6$ etapas. ✓ Coherente coas 13 do escalonado.

### 11.5 Balances de enerxía (estimación)

Con $q=1$: $L = R\,D = 1.65 \times 50 = 82.5$ kmol/h, $V = (R+1)D = 132.5$ kmol/h; en esgotamento $\bar L = L + F = 182.5$, $\bar V = V = 132.5$ kmol/h.

Calor latente medio $\lambda \approx 31.9\ \text{MJ/kmol}$:

$$
Q_R \approx V\,\lambda = 132.5 \times 31.9 \approx 4227\ \text{MJ/h} \approx 1.17\ \text{MW}
$$

$$
Q_C \approx (R+1)D\,\lambda \approx 1.17\ \text{MW}
$$

→ O **refluxo duplica** o consumo enerxético fronte á destilación sen refluxo: a pureza ten un prezo enerxético, e esa é a lección central do compromiso deseño–operación.

---

## 12. Glosario

| Termo | Definición |
|---|---|
| **Etapa teórica (de equilibrio)** | Contacto líquido–vapor onde as correntes de saída están en equilibrio termodinámico |
| **Refluxo** | Líquido condensado devolto á columna para manter a separación |
| **Relación de refluxo $R$** | $L_0/D$; controla pureza vs. enerxía |
| **Refluxo total / mínimo** | Límites do deseño: mínimas etapas / mínima enerxía |
| **Liña q** | Recta que representa o estado térmico da alimentación no diagrama x–y |
| **Volatilidade relativa $\alpha$** | Medida da facilidade de separación de dous compoñentes |
| **Azeótropo** | Composición con $x=y$; inseparable por destilación simple |
| **K (constante de equilibrio)** | $K_i = y_i/x_i$ |
| **Punto de burbulla / orballo** | Temperatura de inicio de ebulición / condensación |
| **McCabe–Thiele** | Método gráfico de etapas para binarios ideais |
| **Ecuacións MESH** | Balances de Materia, Equilibrio, Sumatoria e entalpía (Heat) por etapa |
| **Holdup** | Masa/inventario de líquido retido nun prato ou equipo |
| **Xemelgo dixital** | Réplica virtual sincronizada co proceso físico (ou simulado) |
| **Eficiencia de prato** | Relación entre etapas reais e teóricas |
| **Ponchon–Savarit** | Método rigoroso de etapas con balance de entalpía exacto |

---

## 13. Referencias

1. McCabe, W. L., Smith, J. C., Harriott, P. — *Operacións Unitarias en Enxeñaría Química* (7.ª ed.), McGraw-Hill.
2. Treybal, R. E. — *Operacións de Transferencia de Masa* (2.ª ed.), McGraw-Hill.
3. Wankat, P. C. — *Separations in Chemical Engineering: Equilibrium Staged Separations*, Prentice Hall.
4. Seader, J. D., Henley, E. J., Roper, D. K. — *Separation Process Principles* (4.ª ed.), Wiley.
5. Perry, R. H., Green, D. W. — *Perry's Chemical Engineers' Handbook* (8.ª ed.), McGraw-Hill.
6. Smith, J. M., Van Ness, H. C., Abbott, M. — *Introdución á Termodinámica en Enxeñaría Química* (7.ª ed.), McGraw-Hill.
7. Luyben, W. L. — *Process Modeling, Simulation and Control for Chemical Engineers*, McGraw-Hill.
8. Grieves, M. — *Digital Twin: Manufacturing Excellence through Virtual Factory Replication*, White Paper, 2014.
9. Poling, B. E., Prausnitz, J. M., O'Connell, J. P. — *The Properties of Gases and Liquids* (5.ª ed.), McGraw-Hill.

---

## 14. Suxestións didácticas

**Secuencia suxerida para a clase (2–3 sesións):**

1. **Sesión 1 — Teoría:** seccións 1–5 (operación unitaria, ELV, tipos de destilación). Tarefa: calcular punto de burbulla e orballo dunha mestura dada.
2. **Sesión 2 — Deseño:** seccións 7–8 e exemplo benceno–tolueno. Tarefa: McCabe–Thiele a man para outro $x_D$ e comparar $N_{PS}$.
3. **Sesión 3 — Xemelgo dixital:** seccións 9–10. Os alumnos manipulan o simulador: subir $R$, baixar $Q_R$, cambiar $z_F$, conmutar condensador total ↔ parcial, e **explicar** cada resposta transitoria coa teoría.

**Preguntas guía para o simulador:**

- Que pasa coa pureza do destilado se subo $R$? E con $Q_R$?
- Que pasa se a alimentación entra fría (q > 1)?
- Por que o condensador parcial "equivale" a unha etapa adicional?
- Se o refervedor perde vapor de calefacción, que lazos de control actúan primeiro?
- Como detectaría un operador, só con temperaturas, que o prato de alimentación está mal elixido?

**Rúbrica de avaliación suxerida:** exactitude dos cálculos manuais (30 %), interpretación de transitorios no xemelgo dixital (40 %), xustificación termodinámica das observacións (30 %).

---

*Documento xerado como parte do proxecto "Xemelgo dixital dun destilador con refluxo parcial para o ensino da destilación". As ecuacións poden renderizarse con KaTeX/MathJax na aplicación web, e os diagramas con Mermaid.*
