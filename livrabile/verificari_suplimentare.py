"""Verificări deterministe pentru numerar, negociere și VAN; EUR fără TVA."""
import math
orders=[0,2,2,4,4,4,4,4,0,0,0,0]
delivered=[0,0,0,0,0,2,2,4,4,4,4,4]
weights=[.2,.2,.18,.14,.1,.08,.04,.03,.01,.01,.005,.005]
def cash(advance):
    balance=0; balances=[]
    for i in range(12):
        previous=delivered[i-1] if i else 0
        balance+=orders[i]*(130000*advance-55000)+delivered[i]*(130000*(.9-advance)-44000)+previous*2000-30000*weights[i]-50000/12-(64000 if i==11 else 0)
        balances.append(balance)
    return balances
a,b=cash(.4),cash(.5)
assert abs(min(a)+81433.3333333333)<.01
assert abs(min(b)+10166.6666666667)<.01
assert abs(a[-1]-328000)<.01 and abs(b[-1]-328000)<.01
assert math.ceil((300000/.84+80000)/13500)==33
for advance,balances in [(.4,a),(.5,b)]:
    print('Avans',advance,'Deficit maxim',round(-min(balances),2),'Sold final',round(balances[-1],2))
for benefit in [20000,40000,55000]:
    npv=-140000+sum(benefit*(.6 if year==1 else 1)/1.1**year for year in range(1,6))
    print('Beneficiu',benefit,'VAN',round(npv,2))
print('Verificările au trecut')
