window.MUSHI_DATA = (() => {
  const A=(name,power,effect=null,text='',extra={})=>({name,power,effect,text,...extra});
  const insect=(id,name,color,cost,hp,attacks,passive=null,set='booster1')=>({id,name,type:'insect',color,cost,hp,attacks,passive,set,image:null});
  const enhance=(id,name,cost,effectText,effect,set='booster1')=>({id,name,type:'enhance',color:null,cost,effectText,effect,set,image:null});
  const spell=(id,name,cost,effectText,effect,set='booster1')=>({id,name,type:'spell',color:null,cost,effectText,effect,set,image:null});
  const basic=(id,name,color,cost,hp,power,moveName,set='booster1')=>insect(id,name,color,cost,hp,[A(moveName,power)],null,set);

  const cards={};

  // 赤の虫 1-33
  cards[1]=insect(1,'ニセハナマオウカマキリ','red',6,1600,[A('神のカマ連撃',300,'mantisCombo','攻撃後、相手の場に虫がいればもう1度だけ使用できる。'),A('共食い',2000,'cannibal','使うとき、この虫以外の自分の虫を1つ破壊する。')]);
  cards[2]=insect(2,'リオック','red',5,800,[A('かみちぎる',600)],{type:'altSacrifice2',text:'＜エサにする＞ コストの代わりに自分の場の虫2つを破壊して出せる。'});
  cards[3]=basic(3,'メキシカンレッドニー','red',5,1400,700,'かむ');
  cards[4]=basic(4,'オニヤンマ','red',5,1200,900,'とびかかる');
  cards[5]=insect(5,'トビズムカデ','red',5,1300,[A('キバ',700),A('毒のキバ',500,'persistentDamage','このダメージはターン終了時に回復しない。')]);
  cards[6]=insect(6,'ギンヤンマ','red',5,1100,[A('とびかかる',700)],null,'starter');
  cards[7]=insect(7,'オオカマキリ','red',4,800,[A('カマ連撃',200,'mantisCombo','攻撃後、相手の場に虫がいれば、もう一度だけ使用できる。'),A('共食い',800,'cannibal','使うとき、この虫以外の自分の虫を1つ選び、破壊する。')],null,'starter');
  cards[8]=insect(8,'オオスズメバチ','red',4,800,[A('かみきる',500),A('毒針',800,'oncePerEntry','この技は場にいる間1度だけ使用できる。')]);
  cards[9]=insect(9,'ヤブキリ','red',4,600,[A('かみちぎる',400)],{type:'flyOut',text:'＜とびだす＞ 縄張りから引いたとき、コストなしで場に出せる。'});
  cards[10]=insect(10,'ミイデラゴミムシ','red',4,700,[A('かみつぶす',400)],{type:'poisonMist',text:'＜毒霧噴射＞ 虫の攻撃で破壊されたとき、破壊した虫を手札に戻す。'});
  cards[11]=insect(11,'コオニヤンマ','red',4,800,[A('とびかかる',500)],null,'starter');
  cards[12]=basic(12,'チョウセンカマキリ','red',4,800,600,'カマ斬撃');
  cards[13]=insect(13,'シオヤアブ','red',4,800,[A('さす',500),A('吸血',200,'hpNextTurn','次の相手のターン、この虫の体力を200増やす。',{value:200})]);
  cards[14]=insect(14,'デスストーカー','red',3,800,[A('きりきざむ',200),A('毒針',600,'oncePerEntry','この技は場にいる間1度だけ使用できる。')]);
  cards[15]=insect(15,'アリジゴク','red',3,700,[A('はさみつく',300),A('アリ地獄',0,'sourceAttackLock','次の相手のターン、この虫が場にいる間、対象は攻撃できない。')]);
  cards[16]=insect(16,'キリギリス','red',3,800,[A('かみちぎる',100)],{type:'taunt',text:'＜鳴く＞ 相手はこの虫以外を攻撃できない。'});
  cards[17]=insect(17,'マイマイカブリ','red',3,400,[A('かみつぶす',300)],{type:'flyOut',text:'＜とびだす＞ 縄張りから引いたとき、コストなしで場に出せる。'});
  cards[18]=insect(18,'コガネグモ','red',3,600,[A('かむ',400),A('蜘蛛の糸',0,'sourceAttackLock','次の相手のターン、この虫が場にいる間、対象は攻撃できない。')]);
  cards[19]=basic(19,'オニグモ','red',3,700,300,'かむ');
  cards[20]=insect(20,'ハラビロカマキリ','red',3,600,[A('カマ斬撃',400),A('共食い',600,'cannibal','使うとき、この虫以外の自分の虫を1つ破壊する。')]);
  cards[21]=insect(21,'ヒアリ','red',2,400,[A('毒針',0,'dynamicPower','自分の赤のエサ1枚につき攻撃力200。',{dynamic:'redBait200'})]);
  cards[22]=insect(22,'セアカゴケグモ','red',2,400,[A('かむ',100),A('毒針',400,'oncePerEntry','この技は1度だけ使用できる。')],null,'starter');
  cards[23]=insect(23,'クロシデムシ','red',2,400,[A('死骸の山',0,'dynamicPower','自分の捨て札1枚につき攻撃力100。',{dynamic:'discard100'})]);
  cards[24]=insect(24,'アキアカネ','red',2,500,[A('とびかかる',200)],null,'starter');
  cards[25]=basic(25,'シオカラトンボ','red',2,300,300,'とびかかる');
  cards[26]=basic(26,'ハンミョウ','red',2,400,300,'かむ');
  cards[27]=insect(27,'ミツツボアリ','red',1,200,[A('かみつく',100)],{type:'honey',text:'＜蜜をためる＞ 場に出たとき、手札1枚をエサにしてよい。このターンそのエサのコストは発生しない。'});
  cards[28]=basic(28,'ナナホシテントウ','red',1,300,200,'かみつぶす');
  cards[29]=insect(29,'クロヤマアリ','red',1,300,[A('アリの大群',0,'dynamicPower','自分の場の虫1つにつき攻撃力100。',{dynamic:'field100'})]);
  cards[30]=insect(30,'ナミテントウ','red',1,300,[A('かみつぶす',100)],null,'starter');
  cards[31]=basic(31,'ハナグモ','red',1,200,200,'かむ');
  cards[32]=insect(32,'コカマキリ','red',1,200,[A('カマ斬撃',200),A('共食い',300,'cannibal','使うとき、この虫以外の自分の虫を1つ破壊する。')]);
  cards[33]=basic(33,'クロオオアリ','red',1,400,100,'かみつく');

  // 青の虫 34-66
  cards[34]=insect(34,'ヘラクレスオオカブト','blue',6,1600,[A('神のツノ突進',1000),A('ヘラクレス投げ',0,'bounceOnce','相手の虫を手札に戻す。この技は場にいる間1度だけ使用できる。')]);
  cards[35]=insect(35,'コーカサスオオカブト','blue',5,1200,[A('ツノ突進',800),A('すくい投げ',0,'flip','相手の虫をターン終了時まで裏返す。')]);
  cards[36]=basic(36,'ミヤマクワガタ','blue',4,900,700,'オオアゴバサミ');
  cards[37]=insect(37,'ゴライアスオオツノハナムグリ','blue',5,800,[A('ふみつぶす',500)],{type:'flyOut',text:'＜とびだす＞ 縄張りから引いたとき、コストなしで場に出せる。'});
  cards[38]=basic(38,'ギラファノコギリクワガタ','blue',5,1200,900,'オオアゴバサミ');
  cards[39]=insect(39,'ニシキオオツバメガ','blue',4,1000,[A('すする',300),A('虹色光沢',0,'rainbowColor','相手の場の虫すべてを、このターン選んだ色にする。')]);
  cards[40]=insect(40,'カブトムシ','blue',4,800,[A('ツノ突進',500),A('すくい投げ',0,'flip','相手の虫を1つ選び、ターン終了時まで裏返す。裏返しの間はいないものとして扱う。')],null,'starter');
  cards[40].image='../mushijingi/images/cards/kabutomushi.jpg';
  cards[41]=basic(41,'オオクワガタ','blue',5,1300,800,'オオアゴバサミ');
  cards[42]=basic(42,'オオムラサキ','blue',4,1000,400,'すいとる');
  cards[43]=basic(43,'ヒラタクワガタ','blue',4,800,600,'はさむ');
  cards[44]=insect(44,'ナミアゲハ','blue',4,1100,[A('すいつくす',300)],{type:'pollen',text:'＜りんぷん＞ 相手はこれ以外の虫を攻撃できない。'},'starter');
  cards[45]=basic(45,'アオスジアゲハ','blue',3,700,300,'すいつくす');
  cards[46]=basic(46,'ノコギリクワガタ','blue',3,600,400,'はさむ');
  cards[47]=insect(47,'ミンミンゼミ','blue',3,500,[A('しぼりとる',200)],{type:'flyOut',text:'＜とびだす＞ 縄張りから引いたとき、条件を満たせばコストなしで場に出せる。'},'starter');
  cards[48]=basic(48,'クロアゲハ','blue',3,700,200,'すいつくす');
  cards[49]=basic(49,'オオゾウムシ','blue',3,800,200,'なめる');
  cards[50]=basic(50,'オオスカシバ','blue',3,400,500,'すいつくす');
  cards[51]=basic(51,'ヤエヤママルバネクワガタ','blue',3,500,400,'はさむ');
  cards[52]=basic(52,'クマゼミ','blue',3,700,300,'しぼりとる');
  cards[53]=insect(53,'セイヨウミツバチ','blue',2,500,[A('ハチダマアタック',200),A('決死の一撃',300,'selfDestruct','ダメージを与えた後、この虫を破壊する。')]);
  cards[54]=insect(54,'キムネクマバチ','blue',2,400,[A('かみきる',200),A('毒針',300,'oncePerEntry','この技は場にいる間1度だけ使用できる。')]);
  cards[55]=basic(55,'コクワガタ','blue',2,400,300,'はさむ');
  cards[56]=basic(56,'アブラゼミ','blue',2,500,200,'しぼりとる');
  cards[57]=basic(57,'アカタテハ','blue',2,400,200,'すいとる');
  cards[58]=basic(58,'アカアシクワガタ','blue',2,300,300,'はさむ');
  cards[59]=basic(59,'ヘビトンボ','blue',2,500,100,'かむ');
  cards[60]=insect(60,'ニホンミツバチ','blue',1,400,[A('ハチダマアタック',100),A('決死の一撃',200,'selfDestruct','ダメージを与えた後、この虫を破壊する。')]);
  cards[61]=insect(61,'モンシロチョウ','blue',1,300,[A('すいとる',100)],{type:'emblem',partner:'モンキチョウ',value:300,text:'＜紋章＞ 自分の場にモンキチョウがいれば攻撃力+300。'});
  cards[62]=insect(62,'モンキチョウ','blue',1,300,[A('すいとる',100)],{type:'emblem',partner:'モンシロチョウ',value:300,text:'＜紋章＞ 自分の場にモンシロチョウがいれば攻撃力+300。'});
  cards[63]=insect(63,'カナブン','blue',1,300,[A('たいあたり',100)],null,'starter');
  cards[64]=insect(64,'ヒグラシ','blue',2,200,[A('しぼりとる',200)],null,'starter');
  cards[65]=basic(65,'ネブトクワガタ','blue',1,400,100,'はさむ');
  cards[66]=basic(66,'アオカナブン','blue',1,300,200,'たいあたり');

  // 緑の虫 67-99
  cards[67]=basic(67,'オオキバウスバカミキリ','green',6,1700,1200,'神のキバ無双');
  cards[68]=insect(68,'テナガカミキリ','green',5,1200,[A('キバ無双',800),A('テナガ攻撃',300,'multiTwo','相手の虫を2つ選び、順番に300ダメージずつ与える。')]);
  cards[69]=basic(69,'ジャイアントウェタ','green',5,1300,800,'くらいつく');
  cards[70]=insect(70,'シロスジカミキリ','green',5,1300,[A('くいちぎる',700),A('首を鳴らす',300,'hpNextTurn','次の相手のターン、この虫の体力+300。',{value:300})]);
  cards[71]=insect(71,'トノサマバッタ','green',5,1200,[A('くらいつく',700)],null,'starter');
  cards[72]=insect(72,'オオコノハムシ','green',4,800,[A('かぶりつく',600)],{type:'mimic',text:'＜擬態＞ 場に出た次の相手のターンに攻撃を受けない。'});
  cards[73]=insect(73,'サバクトビバッタ','green',4,1000,[A('くらいつくす',400,'directBaitReturn','直接攻撃したとき、相手はエサ1枚を手札に戻してから縄張りを引く。')]);
  cards[74]=insect(74,'ゴマダラカミキリ','green',4,700,[A('くいちぎる',300)],{type:'flyOut',text:'＜とびだす＞ 縄張りから引いたとき、コストなしで場に出せる。'});
  cards[75]=insect(75,'クワカミキリ','green',4,800,[A('くいちぎる',600),A('首を鳴らす',200,'hpNextTurn','次の相手のターン、この虫の体力+200。',{value:200})]);
  cards[76]=insect(76,'キアゲハ（幼虫）','green',4,900,[A('かじる',400),A('くさいツノ',0,'stinkHorn','相手の虫の次のターンの攻撃力を600下げる。',{value:600})]);
  cards[77]=basic(77,'ショウリョウバッタ','green',4,900,500,'とびはねる');
  cards[78]=insect(78,'ヤマトタマムシ','green',3,600,[A('くいあらす',200),A('虹色光沢',0,'rainbowColor','相手の場の虫すべてを、このターン選んだ色にする。')]);
  cards[79]=insect(79,'ナミアゲハ（幼虫）','green',3,700,[A('かじる',200),A('くさいツノ',0,'stinkHorn','相手の虫を1つ選ぶ。次のターン、その虫の攻撃力を400下げる。',{value:400})],null,'starter');
  cards[80]=insect(80,'ナナフシモドキ','green',3,400,[A('かぶりつく',400)],{type:'mimic',text:'＜擬態＞ 場に出た次の相手のターンに攻撃を受けない。'},'starter');
  cards[81]=basic(81,'クロカタゾウムシ','green',3,1000,200,'くいあさる');
  cards[82]=basic(82,'オオムラサキ（幼虫）','green',3,700,300,'かじる');
  cards[83]=insect(83,'イボバッタ','green',3,400,[A('はねる',300)],{type:'flyOut',text:'＜とびだす＞ 縄張りから引いたとき、コストなしで場に出せる。'});
  cards[84]=insect(84,'コバネイナゴ','green',2,400,[A('はねる',200),A('イナゴの大群',400,'baitSacrifice','使うとき、自分のエサ1枚を破壊する。')]);
  cards[85]=insect(85,'アオクサカメムシ','green',2,400,[A('くいつく',200)],{type:'poisonMist',text:'＜毒霧噴射＞ 虫の攻撃で破壊されたとき、破壊した虫を手札に戻す。'});
  cards[86]=insect(86,'オトシブミ','green',2,600,[A('くいつく',100),A('ゆりかご',0,'hpNextTurn','次の相手のターン、この虫の体力+200。',{value:200})]);
  cards[87]=insect(87,'ゴマダラオトシブミ','green',2,500,[A('くいつく',200),A('ゆりかご',0,'hpNextTurn','次の相手のターン、この虫の体力+200。',{value:200})]);
  cards[88]=basic(88,'イラガ（幼虫）','green',2,400,300,'さす');
  cards[89]=basic(89,'コガネムシ','green',2,500,200,'かじりつく');
  cards[90]=basic(90,'ウバタマムシ','green',2,600,100,'くいあらす');
  cards[91]=insect(91,'ニジュウヤホシテントウ','green',2,300,[A('かみつぶす',300)],null,'starter');
  cards[92]=insect(92,'チャバネアオカメムシ','green',1,200,[A('くいつく',100)],{type:'poisonMist',text:'＜毒霧噴射＞ 虫の攻撃で破壊されたとき、破壊した虫を手札に戻す。'});
  cards[93]=insect(93,'オンブバッタ','green',1,300,[A('はねる',100),A('おんぶ',0,'moveEnhanceAttack','この虫の強化カード1枚を別の自分の虫につけ替える。')]);
  cards[94]=basic(94,'カイコ（幼虫）','green',1,400,100,'かじる');
  cards[95]=insect(95,'ワタアブラムシ','green',1,300,[A('すう',100)],null,'starter');
  cards[96]=basic(96,'マメコガネ','green',1,300,200,'かじりつく');
  cards[97]=insect(97,'ハラヒシバッタ','green',1,300,[A('はねる',100)],{type:'mimic',text:'＜擬態＞ 場に出た次の相手のターンに攻撃を受けない。'});
  cards[98]=basic(98,'ツマグロオオヨコバイ','green',1,200,200,'すう');
  cards[99]=insect(99,'オオミノガ（幼虫）','green',1,300,[A('くいつく',100),A('ミノにこもる',0,'hpNextTurn','次の相手のターン、この虫の体力+200。',{value:200})]);

  // 強化カード
  cards[100]=enhance(100,'雀蜂の毒針',1,'この虫の攻撃力を500増やす。','attack500');
  cards[101]=enhance(101,'玉虫色の羽化',2,'この虫の色を赤か青か緑に変える。','changeColor','starter');
  cards[102]=enhance(102,'空蝉の皮鎧',2,'この虫が破壊されるとき、代わりにこのカードを破壊し、この虫を回復する。','substituteArmor');
  cards[103]=enhance(103,'蚕玉の加護',1,'この虫の体力を800増やす。','hp800');
  cards[106]=enhance(106,'針金虫の道連れ',0,'虫の攻撃によってこの虫が破壊されたとき、この虫を破壊した虫を破壊する。','revenge','starter');
  cards[107]=enhance(107,'天牛の大顎',0,'この虫の攻撃力を300増やす。','attack300','starter');
  cards[108]=enhance(108,'蓑虫の隠れ蓑',0,'この虫の体力を500増やす。','hp500','starter');
  cards[109]=enhance(109,'鳳蝶の蠱惑',0,'相手はこの虫以外を攻撃できない。','tauntAttachment');
  cards[110]=enhance(110,'不滅の王台',0,'この虫が自分の場にいる間、自分は縄張りを引かない。','noTerritory');
  cards[111]=enhance(111,'鋏虫の芯切り鋏',0,'この虫の攻撃で相手が縄張りを引くとき、＜とびだす＞を使えない。','blockFlyOut');
  cards[112]=enhance(112,'剣の息吹',0,'この虫を赤にする。','setRed');
  cards[113]=enhance(113,'勾玉の息吹',0,'この虫を青にする。','setBlue');
  cards[114]=enhance(114,'鏡の息吹',0,'この虫を緑にする。','setGreen');

  // 術カード
  cards[104]=spell(104,'螻蛄の七芸',0,'自分の虫についている強化カード1枚を、別の自分の虫につけ替える。','moveEnhance');
  cards[105]=spell(105,'蜜蝋の壁',0,'このカードを表向きで自分の縄張りに置く。引いたときは捨て札に置く。','addTerritory');
  cards[115]=spell(115,'蟷螂の構え',3,'攻撃済みの自分の虫を1つ選び、もう一度攻撃できるようにする。','readyAttack');
  cards[116]=spell(116,'瀬戸際の虫時雨',4,'自分のエサ場から同じ色の虫を2つまで場に出す。ターン終了時に破壊する。','baitRushTwo');
  cards[117]=spell(117,'退魔の蚊遣り火',3,'相手の虫を1つ選び、破壊する。','destroyOpponent');
  cards[118]=spell(118,'虹の架け橋',1,'自分の捨て札の虫を1つ選び、手札に加える。','recoverInsect','starter');
  cards[119]=spell(119,'蠱毒の因果',2,'山札の一番上を公開する。虫なら場に出しターン終了時に破壊、虫以外なら手札に加える。','topDeckSummon');
  cards[120]=spell(120,'叛逆の蛮勇',1,'自分の捨て札の虫と場の虫を1つずつ入れ替える。出した虫はこのターン攻撃できない。','swapDiscardField');
  cards[121]=spell(121,'斑猫の手招き',0,'自分のエサ場の虫を1つ選び、手札に戻す。','baitToHand');
  cards[122]=spell(122,'百足の狂乱',1,'このターン、自分の場の虫すべての攻撃力を300増やす。','allAttack300');
  cards[123]=spell(123,'蜉蝣の閃き',1,'自分のエサ場の虫を1つ場に出す。ターン終了時に破壊する。','baitTempSummon');
  cards[124]=spell(124,'塵芥虫の爆熱弾',1,'相手の虫を1つ選び、600ダメージを与える。','burn600','starter');
  cards[125]=spell(125,'玉響の蠢き',1,'手札の虫を1つ場に出す。ターン終了時に破壊する。','handTempSummon');
  cards[126]=spell(126,'繚乱の足掻き',0,'同じコストの自分の手札の虫と場の虫を入れ替える。出した虫はこのターン攻撃できない。','sameCostSwap');
  cards[127]=spell(127,'蟲の息吹',1,'これを自分のエサ場に置く。※このエサのコストはこのターン発生しない。','baitBoost','starter');
  cards[128]=spell(128,'埋葬虫の野辺送り',0,'相手の虫についている強化カードを1枚選び、破壊する。','destroyEnhance');
  cards[129]=spell(129,'飛蝗の凶相',0,'このターン、自分の場の虫すべての攻撃力を200増やす。','allAttack200','starter');
  cards[130]=spell(130,'蟲封じの蛍袋',0,'相手の虫を1つ選ぶ。次のターン、その虫は攻撃できない。','blockAttackNext');

  // ===== 第2弾 =====
  // 赤の虫
  cards[201]=insect(201,'リュウジンオオムカデ','red',6,1800,[A('龍神の毒牙',700,'persistentDamage','このダメージはターン終了時に回復しない。')],{type:'jadeColor',text:'＜翡翠色＞ 場に出たとき、このターン青か緑にすることができる。'},'booster2');
  cards[202]=insect(202,'ハナカマキリ','red',4,800,[A('カマ斬撃',600),A('擬態攻撃',500,'mimicColorAttack','場にいる間1度だけ。自分の別の虫の色を選び、このターンその色になる。')],null,'booster2');
  cards[203]=insect(203,'ダイオウサソリ','red',5,1500,[A('きりきざむ',600),A('毒針',700,'oncePerEntry','この技は場にいる間1度だけ使用できる。')],null,'booster2');
  cards[204]=insect(204,'ジョロウグモ','red',3,400,[A('かむ',400),A('蜘蛛の巣',0,'spiderWeb','次の相手のターン、この虫が最初に受けるダメージを0にする。')],null,'booster2');
  cards[205]=insect(205,'キイロスズメバチ','red',4,700,[A('かみきる',500),A('毒針',700,'oncePerEntry','この技は場にいる間1度だけ使用できる。')],null,'booster2');
  cards[206]=basic(206,'アシダカグモ','red',4,1000,400,'かむ','booster2');
  cards[207]=insect(207,'エメラルドゴキブリバチ','red',2,200,[A('かみきる',200),A('操り針',100,'puppetNeedle','この攻撃で虫を破壊したとき、その虫を自分の場に出す。ターン終了時に破壊する。')],null,'booster2');
  cards[208]=basic(208,'オオルリオサムシ','red',2,400,300,'かむ','booster2');
  cards[209]=insect(209,'ジグモ','red',2,300,[A('かむ',300),A('かくれる',0,'hideUntilOpponentEnd','場にいる間1度だけ。次の相手のターン終了時まで裏向きになる。')],null,'booster2');
  cards[210]=basic(210,'ハラグロオオテントウ','red',2,300,300,'かみつぶす','booster2');
  cards[211]=insect(211,'オオナミザトウムシ','red',3,500,[A('盲目攻撃',500,'blindAttack','相手の場に複数の虫がいる場合、攻撃される側が攻撃先を選ぶ。')],null,'booster2');
  cards[212]=insect(212,'キアシナガバチ','red',2,300,[A('かみきる',200),A('毒針',400,'oncePerEntry','この技は場にいる間1度だけ使用できる。')],null,'booster2');
  cards[213]=insect(213,'ケラ','red',2,300,[A('ひっかく',200),A('あなを掘る',0,'nextOwnAttack','次の自分のターン、この虫の攻撃力を300増やす。',{value:300})],null,'booster2');
  cards[214]=insect(214,'ヨコヅナサシガメ','red',1,100,[A('吸血',100,'growthOnTerritory','この技で相手が縄張りを引いたとき、この虫の攻撃力と体力を100増やす。',{value:100})],null,'booster2');
  cards[215]=insect(215,'ハマベハサミムシ','red',1,200,[A('はさむ',100)],{type:'flyOut',text:'＜とびだす＞ 縄張りから引いたとき、コストなしで場に出せる。'},'booster2');

  // 青の虫
  cards[216]=insect(216,'アレクサンドラトリバネアゲハ','blue',6,800,[A('神の吸引',1000)],{type:'undyingDance',text:'＜不死蝶の舞＞ 各ターン最初に受けるダメージを0にする。'},'booster2');
  cards[217]=insect(217,'アトラスオオカブト','blue',5,1200,[A('ツノ突破',700),A('ツノ串刺し',0,'hornSkewer','場にいる間1度だけ。既にダメージを受けている相手なら、攻撃力が100以上のときダメージ前に破壊する。')],null,'booster2');
  cards[218]=basic(218,'レックスゾウカブト','blue',5,1400,600,'ツノ突破','booster2');
  cards[219]=insect(219,'テイオウゼミ','blue',5,1000,[A('しぼりとる',600)],{type:'cicadaEmperor',text:'＜セミの帝王＞ 場に出たとき、捨て札のセミ科の虫を1つ場に出してよい。その虫はこのターン攻撃できない。'},'booster2');
  cards[220]=insect(220,'エゾゼミ','blue',4,700,[A('しぼりとる',600)],{type:'taunt',text:'＜鳴く＞ 相手はこの虫以外を攻撃できない。'},'booster2');
  cards[221]=insect(221,'パリーフタマタクワガタ','blue',3,500,[A('はさむ',400),A('フタマタバサミ',100,'multiTwo','相手の虫を2つ選び、それぞれに攻撃する。')],null,'booster2');
  cards[222]=insect(222,'ディディエールシカクワガタ','blue',3,500,[A('はさむ',400),A('シカツノバサミ',0,'nextOwnAttack','次の自分のターン、この虫の攻撃力を400増やす。',{value:400})],null,'booster2');
  cards[223]=insect(223,'キアゲハ','blue',5,1400,[A('すいつくす',500)],{type:'pollen',text:'＜りんぷん＞ 相手はこの虫以外を攻撃できない。'},'booster2');
  cards[224]=insect(224,'オウゴンオニクワガタ','blue',2,300,[A('黄金バサミ',200,'blockFlyOutAttack','この技で相手が縄張りを引くとき、＜とびだす＞を使えない。'),A('鬼バサミ',400,'oncePerEntry','この技は場にいる間1度だけ使用できる。')],null,'booster2');
  cards[225]=insect(225,'クラウディーナミイロタテハ','blue',3,400,[A('すいとる',400),A('かくれる',0,'hideUntilOpponentEnd','場にいる間1度だけ。次の相手のターン終了時まで裏向きになる。')],null,'booster2');
  cards[226]=basic(226,'アサギマダラ','blue',3,700,300,'すいとる','booster2');
  cards[227]=insect(227,'サツマニシキ','blue',3,400,[A('すう',300)],{type:'poisonBubble',text:'＜毒の泡＞ 虫の攻撃で破壊されたとき、その攻撃した虫は次の自分のターン中に攻撃を受けると破壊される。'},'booster2');
  cards[228]=basic(228,'ツクツクボウシ','blue',2,300,300,'しぼりとる','booster2');
  cards[229]=basic(229,'ベニシジミ','blue',1,200,200,'すいとる','booster2');
  cards[230]=insect(230,'チッチゼミ','blue',1,100,[A('しぼりとる',200)],{type:'flyOut',text:'＜とびだす＞ 縄張りから引いたとき、コストなしで場に出せる。'},'booster2');

  // 緑の虫
  cards[231]=insect(231,'キマダラドクバッタ','green',6,1200,[A('神の猛毒',1000)],{type:'toxicRevenge',text:'＜トウワタ毒＞ 虫の攻撃で破壊されたとき、破壊した虫を破壊する。'},'booster2');
  cards[232]=basic(232,'アレクサンドラトリバネアゲハ（幼虫）','green',3,500,400,'かじる','booster2');
  cards[233]=insect(233,'ロードハウナナフシ','green',5,1200,[A('かぶりつく',800)],{type:'mimic',text:'＜擬態＞ 場に出た次の相手のターンに攻撃を受けない。'},'booster2');
  cards[234]=insect(234,'ヘラクレスサン（幼虫）','green',5,1300,[A('大食漢',600,'growthOnTerritory','この技で相手が縄張りを引いたとき、この虫の攻撃力と体力を200増やす。',{value:200})],null,'booster2');
  cards[235]=basic(235,'ヤママユ（幼虫）','green',4,800,700,'かじる','booster2');
  cards[236]=basic(236,'ウスバカミキリ','green',4,700,600,'キバ無双','booster2');
  cards[237]=insect(237,'クルマバッタ','green',4,400,[A('とびはねる',500)],{type:'flyOut',text:'＜とびだす＞ 縄張りから引いたとき、コストなしで場に出せる。'},'booster2');
  cards[238]=basic(238,'クビアカツヤカミキリ','green',4,800,500,'くいちぎる','booster2');
  cards[239]=basic(239,'ルリボシカミキリ','green',3,400,500,'くいちぎる','booster2');
  cards[240]=insect(240,'プラチナコガネ','green',1,200,[A('シロガネタックル',200,'flipBaitOnTerritory','この技で相手が縄張りを引いたとき、相手の表向きのエサを1枚裏向きにしてよい。')],null,'booster2');
  cards[241]=insect(241,'アサギマダラ（幼虫）','green',2,400,[A('かじる',300)],{type:'poisonBody',text:'＜毒の体＞ 名前に「毒」を含む相手の虫の技から受けるダメージを0にする。'},'booster2');
  cards[242]=insect(242,'カレハバッタ','green',2,200,[A('はねる',300)],{type:'mimic',text:'＜擬態＞ 場に出た次の相手のターンに攻撃を受けない。'},'booster2');
  cards[243]=insect(243,'クロカミキリ','green',2,400,[A('くいちぎる',200),A('首を鳴らす',100,'hpNextTurn','次の相手のターン、この虫の体力を100増やす。',{value:100})],null,'booster2');
  cards[244]=insect(244,'トビイロウンカ','green',1,200,[A('すう',100)],{type:'flyOut',text:'＜とびだす＞ 縄張りから引いたとき、コストなしで場に出せる。'},'booster2');
  cards[245]=insect(245,'シロオビアワフキ（幼虫）','green',1,500,[],{type:'foamGuard',text:'＜泡のまもり＞ この虫は攻撃できず、相手の術カードの対象に選ばれない。'},'booster2');

  // 強化カード
  cards[246]=enhance(246,'無欠の息吹',1,'この虫は弱点による2倍ダメージを受けない。','noWeakness','booster2');
  cards[247]=enhance(247,'蚰蜒の足切り',0,'この虫が虫の攻撃でダメージを受けるとき、そのダメージを0にしてこのカードを破壊する。','zeroAttackDamageOnce','booster2');
  cards[248]=enhance(248,'金蚉の甲冑',1,'この虫の体力と攻撃力を300増やす。','hpAttack300','booster2');
  cards[249]=enhance(249,'兜虫の甲冑',2,'この虫の体力と攻撃力を500増やす。','hpAttack500','booster2');
  cards[250]=enhance(250,'口寄せの時蛹',4,'手札の虫を1つ場に出し、このカードをつける。このカードがついている虫は攻撃できない。次の相手のターン終了時にこのカードを破壊する。','summonWithAttachment','booster2');

  // 術カード
  cards[251]=spell(251,'白夜の羽化',0,'自分の場の「（幼虫）」の虫をエサ場に置き、手札から同名の成虫を場に出す。','evolveLarva','booster2');
  cards[252]=spell(252,'蟲祓いの煙幕',0,'このターン、相手が縄張りから虫を引いても＜とびだす＞を使えない。','smokeNoFlyOut','booster2');
  cards[253]=spell(253,'電気虫の稲妻',2,'相手の虫を1つ選び、1000ダメージを与える。','burn1000','booster2');
  cards[254]=spell(254,'金色の顎門',0,'このターン、自分の虫1つの攻撃力を500増やす。','singleAttack500','booster2');
  cards[255]=spell(255,'蟻の収穫',0,'自分の表向きのエサ場から強化カードか術カードを1枚選び、手札に戻す。','harvestBaitSpecial','booster2');

  // ===== 第3弾 =====
  // 赤の虫
  cards[301]=insect(301,'オオエンマハンミョウ','red',6,1700,[A('神のアギト',1000),A('破壊のアギト',4000,'targetHasEnhance','強化カードがついている相手の虫にだけ使用できる。')],null,'booster3');
  cards[302]=insect(302,'タガメ','red',5,1100,[A('オオヅメバサミ',800)],{type:'aquaticCost',text:'＜水生昆虫＞ 自分の青のエサ2枚につき、出すためのコストを1減らす。'},'booster3');
  cards[303]=insect(303,'オオジョロウグモ','red',4,1100,[A('かむ',400)],{type:'spellTaxLow',text:'＜円網＞ この虫が場にいる間、元のコストが1以下の術カードはコストが1増える。'},'booster3');
  cards[304]=insect(304,'ミズカマキリ','red',4,800,[A('ツメバサミ',500)],{type:'aquaticCost',text:'＜水生昆虫＞ 自分の青のエサ2枚につき、出すためのコストを1減らす。'},'booster3');
  cards[305]=insect(305,'タイコウチ','red',3,500,[A('ツメバサミ',400)],{type:'aquaticCost',text:'＜水生昆虫＞ 自分の青のエサ2枚につき、出すためのコストを1減らす。'},'booster3');
  cards[306]=insect(306,'マダラサソリ','red',3,600,[A('きりきざむ',400),A('弱毒針',300,'weakPoison','ダメージを与える前に相手の表向きのエサ1枚を裏向きにしてよい。')],null,'booster3');
  cards[307]=insect(307,'ヤエヤマサソリ','red',2,400,[A('きりきざむ',200),A('弱毒針',100,'weakPoison','ダメージを与える前に相手の表向きのエサ1枚を裏向きにしてよい。')],null,'booster3');
  cards[308]=insect(308,'ハヤシノウマオイ','red',2,400,[A('かみちぎる',200),A('ウマオイコンボ',600,'partnerRequired','自分の場にハタケノウマオイがいるときだけ使用できる。',{partner:'ハタケノウマオイ'})],null,'booster3');
  cards[309]=insect(309,'ハタケノウマオイ','red',2,400,[A('かみちぎる',200),A('ウマオイコンボ',600,'partnerRequired','自分の場にハヤシノウマオイがいるときだけ使用できる。',{partner:'ハヤシノウマオイ'})],null,'booster3');
  cards[310]=insect(310,'ナミゲンゴロウ','red',3,400,[A('くらいつく',500)],{type:'aquaticCost',text:'＜水生昆虫＞ 自分の青のエサ2枚につき、出すためのコストを1減らす。'},'booster3');
  cards[311]=insect(311,'サシハリアリ','red',4,800,[A('かみつく',500),A('激痛針',200,'handDiscardAfterTerritory','場にいる間1度だけ。この技で相手が縄張りを引いた後、相手は手札1枚を捨てる。')],null,'booster3');
  cards[312]=insect(312,'ツェツェバエ','red',2,600,[A('さす',600)],{type:'bloodPrice',text:'＜血の対価＞ 自分の縄張り1枚につき、この虫の体力と攻撃力を100減らす。'},'booster3');
  cards[313]=insect(313,'ナミアメンボ','red',2,300,[A('すいとり針',200)],{type:'aquaticCost',text:'＜水生昆虫＞ 自分の青のエサ2枚につき、出すためのコストを1減らす。'},'booster3');
  cards[314]=basic(314,'ハグロトンボ','red',1,400,100,'とびかかる','booster3');
  cards[315]=insect(315,'アダンソンハエトリ','red',1,300,[A('かむ',100)],{type:'flyCatcher',text:'＜蠅取り＞ 虫の攻撃で破壊されたとき、相手の手札が5枚以上なら相手は手札1枚を捨てる。'},'booster3');

  // 青の虫
  cards[316]=insect(316,'パラワンオオヒラタクワガタ','blue',6,1500,[A('神のオオアゴ',1000)],{type:'sapCost',text:'＜樹液酒場＞ 自分の青のエサ2枚につき、出すためのコストを1減らす。'},'booster3');
  cards[317]=insect(317,'サタンオオカブト','blue',5,800,[A('ツノ突破',800)],{type:'demonHorn',text:'＜魔王のツノ＞ 虫の攻撃で破壊されたとき、相手は縄張りを引く前に手札1枚を捨てる。'},'booster3');
  cards[318]=insect(318,'グランディスオオクワガタ','blue',5,1200,[A('オオアゴバサミ',600)],{type:'enhanceDiscount',value:1,text:'＜偉大な力＞ この虫につける強化カードのコストを1減らす。'},'booster3');
  cards[319]=insect(319,'ムクゲコノハ','blue',5,1200,[A('すする',500)],{type:'nightFlight',text:'＜夜間飛行＞ 自分の場に虫がいなければ、出すためのコストを1減らす。'},'booster3');
  cards[320]=insect(320,'メタリフェルホソアカクワガタ','blue',4,800,[A('はさむ',600)],{type:'doubleEnhance',text:'＜大太刀二刀流＞ 強化カードは1枚だけつけられ、その攻撃力・体力の修正値を2倍にする。'},'booster3');
  cards[321]=insect(321,'グラントシロカブト','blue',4,900,[A('ツノ突進',500)],{type:'whiteShell',text:'＜白色甲殻＞ 場に出た次の相手のターン、弱点による2倍ダメージを受けない。'},'booster3');
  cards[322]=insect(322,'ヤンバルテナガコガネ','blue',5,1300,[A('たいあたり',600)],{type:'spellSummonLock',text:'＜奇怪な両腕＞ この虫が場にいる間、術カードの効果で場に出た虫はそのターン攻撃できない。'},'booster3');
  cards[323]=basic(323,'ベニスズメ','blue',3,400,500,'すする','booster3');
  cards[324]=insect(324,'ニジイロクワガタ','blue',2,300,[A('はさむ',300)],{type:'baitColor',text:'＜七色反射＞ 場に出たとき、自分の表向きのエサすべてをこのターン赤・青・緑のいずれかにしてよい。'},'booster3');
  cards[325]=insect(325,'キンオニクワガタ','blue',2,300,[A('はさむ',300)],{type:'enhanceDiscount',value:1,text:'＜金色甲殻＞ この虫につける強化カードのコストを1減らす。'},'booster3');
  cards[326]=insect(326,'イチモンジセセリ','blue',2,400,[A('すする',300)],{type:'loneAttack',value:100,text:'＜一文字＞ 自分の場の虫がこの虫だけなら攻撃力を100増やす。'},'booster3');
  cards[327]=basic(327,'ギフチョウ','blue',2,600,100,'すいとる','booster3');
  cards[328]=insect(328,'トラツリアブ','blue',0,100,[],{type:'cannotAttack',text:'＜ふわふわ＞ この虫は攻撃できない。'},'booster3');
  cards[329]=insect(329,'イラガセイボウ','blue',1,200,[A('寄生攻撃',200)],{type:'larvaSacrificeSummon',text:'＜食い破る＞ 自分の場の名前に（幼虫）を含む虫1つを破壊することで、コストを支払わず場に出せる。'},'booster3');
  cards[330]=insect(330,'クロカナブン','blue',1,400,[A('たいあたり',300)],{type:'blackShine',text:'＜黒光り＞ 強化カードがついていなければターン終了時にこの虫を破壊する。'},'booster3');

  // 緑の虫
  cards[331]=insect(331,'サカダチコノハナナフシ','green',6,1800,[A('神の逆鱗',1000),A('逆立ち返し',0,'reverseSwap','相手の場の虫と相手の表向きのエサ場の虫を1つずつ選んで入れ替え、その後この技の攻撃力分のダメージを新しく場に出た虫へ与える。')],null,'booster3');
  cards[332]=insect(332,'キョジンツユムシ','green',5,1300,[A('かみちぎる',1000)],{type:'greenBaitAttackGate',value:3,text:'＜新緑の呪縛＞ 自分の緑のエサが3枚以上なければ攻撃できない。'},'booster3');
  cards[333]=insect(333,'トゲナナフシ','green',5,1100,[A('かぶりつく',700)],{type:'thornMimic',value:300,text:'＜トゲ擬態＞ 場に出た次の相手のターン攻撃を受けない。相手ターン中に自分が縄張りを引くたび、攻撃力を300増やす。'},'booster3');
  cards[334]=insect(334,'エダナナフシ','green',3,200,[A('かぶりつく',500)],{type:'mimic',text:'＜擬態＞ 場に出た次の相手のターンに攻撃を受けない。'},'booster3');
  cards[335]=insect(335,'クツワムシ','green',4,900,[A('かみちぎる',700)],{type:'greenBaitAttackGate',value:2,text:'＜新緑の呪い＞ 自分の緑のエサが2枚以上なければ攻撃できない。'},'booster3');
  cards[336]=basic(336,'マダラバッタ','green',3,600,400,'とびはねる','booster3');
  cards[337]=insect(337,'グンジョウオオコブハムシ','green',2,300,[A('くいあさる',200)],{type:'jewelInsect',text:'＜宝石昆虫＞ 虫の攻撃で破壊されたとき、この虫を捨て札ではなく持ち主のエサ場に置く。'},'booster3');
  cards[338]=basic(338,'アオマダラタマムシ','green',2,600,200,'くいあらす','booster3');
  cards[339]=insect(339,'アカスジキンカメムシ','green',3,300,[A('くいつく',300)],{type:'entryMist',value:300,text:'＜毒霧散布＞ 場に出たとき、相手の虫1つに300ダメージを与えてよい。'},'booster3');
  cards[340]=insect(340,'モモブトオオルリハムシ','green',3,500,[A('モモブト蹴り',0,'dynamicPower','自分の場の緑の虫1つにつき攻撃力300。',{dynamic:'greenField300'})],null,'booster3');
  cards[341]=basic(341,'オオルリハムシ','green',2,500,100,'くいあさる','booster3');
  cards[342]=insect(342,'ナナホシキンカメムシ','green',2,300,[A('くいつく',200)],{type:'entryMist',value:200,text:'＜毒霧散布＞ 場に出たとき、相手の虫1つに200ダメージを与えてよい。'},'booster3');
  cards[343]=insect(343,'チャドクガ（幼虫）','green',2,200,[A('かじる',200)],{type:'skipTerritoryChoice',text:'＜毒蛾の毛針＞ この虫が破壊されたとき、縄張りを引かないことを選べる。'},'booster3');
  cards[344]=insect(344,'ナキイナゴ','green',1,300,[A('はねる',100)],{type:'taunt',text:'＜鳴く＞ 相手はこの虫以外を攻撃できない。'},'booster3');
  cards[345]=insect(345,'ベニツチカメムシ','green',1,200,[A('くいつく',100)],{type:'entryMist',value:100,text:'＜毒霧散布＞ 場に出たとき、相手の虫1つに100ダメージを与えてよい。'},'booster3');

  // 強化カード
  cards[346]=enhance(346,'鍬形虫の甲冑',3,'この虫の体力と攻撃力を700増やす。＜装着＞ 縄張りから引いたとき、自分の表向きの場の虫につけてよい。','hpAttack700','booster3');
  cards[346].territoryAttach=true;
  cards[347]=enhance(347,'黄金虫の甲冑',1,'この虫の体力と攻撃力を200増やす。＜装着＞ 縄張りから引いたとき、自分の表向きの場の虫につけてよい。','hpAttack200','booster3');
  cards[347].territoryAttach=true;
  cards[348]=enhance(348,'白銀蜘蛛の糸',6,'自分の捨て札の虫を2つ選ぶ。このカードを一方につけ、2つとも場に出す。この効果で出た虫は＜＞の技と効果を失う。このカードが破壊されたとき、それらの虫を破壊する。','silverThread','booster3');
  cards[349]=enhance(349,'七節の秘伝書',1,'次の相手のターン、この虫は攻撃を受けない。虫の攻撃でこの虫が破壊されたとき、このカードを手札に戻す。','secretBook','booster3');

  // 術カード
  cards[350]=spell(350,'女王蜂の匂い袋',3,'手札から名前に「バチ」を含む虫を2つまで場に出す。ターン終了時に破壊する。','queenBeeSummon','booster3');
  cards[351]=spell(351,'刺蠅の血盟',4,'4コストを支払う代わりに自分の縄張り2枚を捨て札にしてもよい。相手の虫1つを破壊する。','bloodPact','booster3');
  cards[352]=spell(352,'藪蚊の密約',0,'自分の縄張りを1枚引く。この効果で引いた虫は＜とびだす＞を使えない。','drawOwnTerritory','booster3');
  cards[353]=spell(353,'楠葉の護符',2,'自分の虫1つを次の相手のターン終了時まで裏向きにする。裏向きの間はいないものとして扱う。','hideOwn','booster3');
  cards[354]=spell(354,'息吹の解放',0,'追加で好きなだけコストを支払い、相手の虫1つに支払った追加コスト×300ダメージ。0コストでも使用できる。','breathRelease','booster3');
  cards[355]=spell(355,'軍隊蟻の蹂躙',2,'このターン、自分の場の虫すべての攻撃力を500増やす。','allAttack500','booster3');
  cards[356]=spell(356,'四柱の間引き',3,'手札が5枚以上あるプレイヤーは、それぞれ手札が4枚になるよう同時に捨てる。','trimHands4','booster3');
  cards[357]=spell(357,'衣蛾の虫喰み',0,'自分の裏向きのエサを3枚まで表向きにする。','flipOwnBaitUp','booster3');
  cards[358]=spell(358,'土蜘蛛の地固め',0,'このターン次に使う強化カードのコストを1減らす。複数回使うと累積する。','nextEnhanceDiscount','booster3');
  cards[359]=spell(359,'鬼蜘蛛の金縛り',0,'次の相手のターン、相手の術カードのコストを1増やす。複数回使うと累積する。','nextOpponentSpellTax','booster3');
  cards[360]=spell(360,'飛蝗の待ち伏せ',3,'自分の縄張りが0枚になるまで、自分の～バッタ科・～イナゴ科の虫は＜とびだす＞を持つ。','grasshopperAmbush','booster3');

  // ===== 第4弾 =====
  // 赤の虫
  cards[401]=insect(401,'テイオウムカシヤンマ','red',6,1500,[A('神の襲撃',1100)],{type:'ancientFossil',text:'＜生きた化石＞ 自分の捨て札の＜生きた化石＞を持つ虫1つにつき、出すためのコストを1減らす。'},'booster4');
  cards[402]=insect(402,'コバルトブルータランチュラ','red',5,1300,[A('かむ',600),A('神経毒',200,'handDiscardAfterTerritory','場にいる間1度だけ。この技で相手が縄張りを引いた後、相手は手札1枚を捨てる。')],null,'booster4');
  cards[403]=insect(403,'オオジョロウグモ','red',4,1100,[A('かむ',400)],{type:'spellTaxLow',text:'＜円網＞ この虫が場にいる間、元のコストが1以下の術カードのコストを1増やす。'},'booster4');
  cards[404]=insect(404,'バイオリンムシ','red',5,1500,[A('かみちぎる',500)],{type:'cover',text:'＜かばう＞ 縄張りから引いたとき場に出してよい。そうしたなら相手はこれ以外を攻撃できず、ターン終了時にこれを手札に戻す。'},'booster4');
  cards[405]=insect(405,'コロギス','red',3,700,[A('かみちぎる',300)],{type:'dangerSense',text:'＜危険察知＞ この虫が場にいる間、両プレイヤーの「場に出たとき」の＜＞技は使えない。'},'booster4');
  cards[406]=insect(406,'バーチェルグンタイアリ メジャー','red',2,300,[A('蟻の蹂躙',0,'dynamicPower','自分の場のアリ1つにつき攻撃力200。',{dynamic:'antField200'})],{type:'militaryLink',text:'＜軍隊連携＞ 自分の場の＜軍隊連携＞を持つ虫の技を使用できる。'},'booster4');
  cards[407]=insect(407,'タンザニアバンデットウデムシ','red',3,500,[A('きりきざむ',400),A('盗賊の大腕',300,'banditArm','場にいる間1度だけ。相手の手札をランダムに1枚選び、虫なら相手の場へ、術・強化なら相手のエサ場へ置く。')],null,'booster4');
  cards[408]=insect(408,'バーチェルグンタイアリ メディア','red',1,100,[A('毒針',200,'attackTurnsGreen','攻撃後、このターンこの虫の色を緑にする。')],{type:'militaryLink',text:'＜軍隊連携＞ 自分の場の＜軍隊連携＞を持つ虫の技を使用できる。'},'booster4');
  cards[409]=insect(409,'チョウトンボ','red',2,600,[A('とびかかる',100)],{type:'cover',text:'＜かばう＞ 縄張りから引いたとき場に出してよい。そうしたなら相手はこれ以外を攻撃できず、ターン終了時にこれを手札に戻す。'},'booster4');
  cards[410]=insect(410,'ムカシトンボ','red',2,300,[A('とびかかる',300)],{type:'ancientFossil',text:'＜生きた化石＞ 自分の捨て札の＜生きた化石＞を持つ虫1つにつき、出すためのコストを1減らす。'},'booster4');
  cards[411]=insect(411,'オニヤンマ（幼虫）','red',3,400,[A('下アゴバサミ',500)],{type:'waterLarva',text:'＜水生幼虫＞ 相手の青のエサ3枚につき、出すためのコストを1減らす。'},'booster4');
  cards[412]=insect(412,'ギンヤンマ（幼虫）','red',2,300,[A('下アゴバサミ',200)],{type:'waterLarva',text:'＜水生幼虫＞ 相手の青のエサ3枚につき、出すためのコストを1減らす。'},'booster4');
  cards[413]=insect(413,'バーチェルグンタイアリ マイナー','red',1,300,[A('橋渡し',100,'forcedTargetNext','次の相手のターン、相手はこの虫以外を攻撃できない。')],{type:'militaryLink',text:'＜軍隊連携＞ 自分の場の＜軍隊連携＞を持つ虫の技を使用できる。'},'booster4');
  cards[414]=insect(414,'コカブトムシ','red',1,200,[A('くいやぶる',200)],{type:'scavenger',value:200,text:'＜死骸あさり＞ 自分の捨て札に赤・青・緑の虫がそれぞれあれば攻撃力と体力を200増やす。'},'booster4');

  // 青の虫
  cards[415]=insect(415,'ネプチューンオオカブト','blue',6,1600,[A('神のツノ突進',1000)],{type:'intimidateCost',text:'＜威圧の大角＞ この虫が場にいる間、技を2つ以上持つ虫を出すためのコストを1増やす。'},'booster4');
  cards[416]=insect(416,'マンディブラリスフタマタクワガタ','blue',5,1400,[A('オオアゴバサミ',1000)],{type:'mandatoryBaitSacrifice',text:'＜狂暴化＞ 場に出たとき、自分のエサ1つを破壊する。できなければこの虫を破壊する。'},'booster4');
  cards[417]=insect(417,'ゴマダラチョウ','blue',4,1000,[A('すいつくす',400),A('あおぐ',0,'spellTaxNextTurn','次の相手のターン、相手の術カードのコストを1増やす。')],null,'booster4');
  cards[418]=insect(418,'ゴホンヅノカブト','blue',5,1300,[A('ツノ突進',700),A('みだれ突き',300,'multiTwo','相手の虫を2つ選び、それぞれに攻撃する。')],null,'booster4');
  cards[419]=insect(419,'アントアンカブトハナムグリ','blue',3,700,[A('ツノ突進',300)],{type:'cover',text:'＜かばう＞ 縄張りから引いたとき場に出してよい。そうしたなら相手はこれ以外を攻撃できず、ターン終了時にこれを手札に戻す。'},'booster4');
  cards[420]=insect(420,'ジャコウアゲハ','blue',4,700,[A('すいつくす',600)],{type:'poisonBody',text:'＜毒の体＞ 名前に「毒」を含む相手の虫の技から受けるダメージを0にする。'},'booster4');
  cards[421]=insect(421,'オオトモエ','blue',3,600,[A('すする',300)],{type:'eyePattern',value:2,text:'＜巴紋＞ 虫の攻撃で破壊されたとき、相手のエサを2枚まで裏向きにしてよい。'},'booster4');
  cards[422]=basic(422,'キタテハ','blue',3,500,400,'すいとる','booster4');
  cards[423]=insect(423,'イチモンジチョウ','blue',3,500,[A('すう',300)],{type:'loneAttack',value:200,text:'＜一文字＞ 自分の場の虫がこの虫だけなら攻撃力を200増やす。'},'booster4');
  cards[424]=insect(424,'シロテンハナムグリ','blue',2,300,[A('たいあたり',300),A('花粉食い',0,'baitFlipOnce','場にいる間1度だけ。相手の表向きのエサ1枚を裏向きにしてよい。')],null,'booster4');
  cards[425]=insect(425,'アオハナムグリ','blue',1,200,[A('たいあたり',100),A('花粉食い',0,'baitFlipOnce','場にいる間1度だけ。相手の表向きのエサ1枚を裏向きにしてよい。')],null,'booster4');
  cards[426]=insect(426,'メンガタクワガタ','blue',2,400,[A('はさむ',400)],{type:'spellTaunt',text:'＜威嚇の面＞ 相手が自分の虫を対象に術カードを使うとき、この虫を選ばなければならない。'},'booster4');
  cards[427]=insect(427,'スジクワガタ','blue',1,300,[A('オノバサミ',100,'bonusVsEnhanced','強化カードがついた虫へ攻撃するとき攻撃力を300増やす。',{value:300})],null,'booster4');
  cards[428]=insect(428,'オニクワガタ','blue',1,400,[A('はさむ',0),A('オニバサミ',200,'oncePerEntry','この技は場にいる間1度だけ使用できる。')],null,'booster4');

  // 緑の虫
  cards[429]=insect(429,'タイタンオオキバウスバカミキリ','green',6,1500,[A('神のキバ無双',1000)],{type:'giantBait',threshold:8,value:1000,text:'＜巨大甲虫＞ 自分のエサが8枚以上なら攻撃力と体力を1000増やす。'},'booster4');
  cards[430]=basic(430,'シタベニオオバッタ','green',5,1200,900,'はねる','booster4');
  cards[431]=insect(431,'カヤキリ','green',4,1100,[A('かみちぎる',300)],{type:'cover',text:'＜かばう＞ 縄張りから引いたとき場に出してよい。そうしたなら相手はこれ以外を攻撃できず、ターン終了時にこれを手札に戻す。'},'booster4');
  cards[432]=insect(432,'アシナガオオコノハギス','green',5,1300,[A('かみちぎる',700)],{type:'giantBait',threshold:8,value:500,text:'＜巨大昆虫＞ 自分のエサが8枚以上なら攻撃力と体力を500増やす。'},'booster4');
  cards[433]=insect(433,'ヨナグニサン（幼虫）','green',4,900,[A('大食漢',300,'growthOnTerritory','この技で相手が縄張りを引いたとき、この虫の攻撃力と体力を200増やす。',{value:200})],null,'booster4');
  cards[434]=insect(434,'ホウセキゾウムシ','green',3,700,[A('くいあさる',200)],{type:'jewelInsect',text:'＜宝石昆虫＞ 虫の攻撃で破壊されたとき、この虫を捨て札ではなく持ち主のエサ場に置く。'},'booster4');
  cards[435]=basic(435,'アオタマムシ','green',3,800,200,'くいあらす','booster4');
  cards[436]=insect(436,'ジャコウアゲハ（幼虫）','green',3,600,[A('かじる',400),A('共食い',600,'cannibal','使うとき、この虫以外の自分の虫を1つ破壊する。')],null,'booster4');
  cards[437]=insect(437,'オオトモエ（幼虫）','green',1,300,[A('かじる',100)],{type:'eyePattern',value:1,text:'＜眼状紋＞ 虫の攻撃で破壊されたとき、相手のエサを1枚まで裏向きにしてよい。'},'booster4');
  cards[438]=insect(438,'トラカミキリ','green',1,200,[A('くいちぎる',200)],{type:'batesMimic',text:'＜ベイツ型擬態＞ 自分の場にこの虫以外の虫がいるなら、この虫は攻撃されない。'},'booster4');
  cards[439]=insect(439,'ドロハマキチョッキリ','green',2,500,[A('かじる',100),A('ゆりかご落とし',500,'sacrificeEnhanceAttack','使うとき、自分の強化カード1枚を破壊する。')],null,'booster4');
  cards[440]=insect(440,'ヨモギエダシャク（幼虫）','green',1,200,[A('かじる',100)],{type:'discardEnhanceRecover',text:'＜尺取り＞ 虫の攻撃で破壊されたとき、すでに捨て札にある強化カード1枚を手札に戻してよい。'},'booster4');
  cards[441]=insect(441,'ヒメオビオオキノコ','green',1,200,[A('くいあらす',200)],{type:'fungusPower',value:100,text:'＜キノコパワー＞ 強化カードがついていれば攻撃力と体力を100増やす。'},'booster4');
  cards[442]=basic(442,'ニシキオオツバメガ（幼虫）','green',1,300,100,'かじる','booster4');

  // 無色の虫
  cards[443]=insect(443,'カイコ','colorless',4,900,[A('はばたく',300)],{type:'silenceAll',text:'＜くちなし＞ この虫が場にいるとき、自分と相手の虫は＜くちなし＞以外の＜＞の技を失う。'},'booster4');
  cards[444]=insect(444,'オカダンゴムシ','colorless',1,200,[A('たいあたり',100),A('まるまる',0,'hpNextTurn','次の相手のターン、この虫の体力を200増やす。',{value:200})],null,'booster4');
  cards[445]=insect(445,'ヒジリタマオシコガネ','colorless',2,400,[A('フンコロガシ',200,'dungRoll','ダメージ前に相手の捨て札1枚を選び、裏向きで山札の一番下に置いてよい。')],null,'booster4');

  // 強化カード
  cards[446]=enhance(446,'天与の大顎',1,'この虫の攻撃力を400増やす。＜装着＞ 縄張りから引いたとき、自分の虫につけてよい。','attack400','booster4'); cards[446].territoryAttach=true;
  cards[447]=enhance(447,'天与の毒針',2,'この虫の攻撃力を700増やす。＜装着＞ 縄張りから引いたとき、自分の虫につけてよい。','attack700','booster4'); cards[447].territoryAttach=true;
  cards[448]=enhance(448,'天与の甲殻',1,'この虫の体力を600増やす。＜装着＞ 縄張りから引いたとき、自分の虫につけてよい。','hp600','booster4'); cards[448].territoryAttach=true;
  cards[449]=enhance(449,'天与の巨躯',2,'この虫の体力を1000増やす。＜装着＞ 縄張りから引いたとき、自分の虫につけてよい。','hp1000','booster4'); cards[449].territoryAttach=true;
  cards[450]=enhance(450,'死神蟲の蛮刀',3,'この虫の攻撃力を1000増やす。＜装着＞ 縄張りから引いたとき、自分の虫につけてよい。','attack1000','booster4'); cards[450].territoryAttach=true;
  cards[451]=enhance(451,'術招きの鱗粉',0,'相手が自分の虫を対象に術カードを使うとき、このカードがついた虫を選ばなければならない。','spellTauntAttachment','booster4');
  cards[452]=enhance(452,'蟷螂の大鎌',3,'この虫の攻撃で相手の虫を破壊したとき、相手は別の自分の虫1つを選び破壊する。','mantisSickle','booster4');
  cards[453]=enhance(453,'蠱術の贋作',0,'つけるとき、他の自分の強化カード1枚を選ぶ。その強化カードの攻撃力・体力の修正値を写す。選んだ強化カードが破壊されたとき、このカードも破壊する。','imitation','booster4');
  cards[454]=enhance(454,'軍配虫の大団扇',0,'この虫の攻撃で相手の虫を破壊したとき、その虫を捨て札ではなく裏向きで山札の一番下に置く。縄張りは通常通り引く。','militaryFan','booster4');

  // 術カード
  cards[455]=spell(455,'若虫の転生',1,'自分の場の成虫と同名の（幼虫）の虫を自分の捨て札から1つ選び場に出す。その虫はこのターン攻撃できない。','youngReincarnation','booster4');
  cards[456]=spell(456,'怨霊の虫送り',3,'相手の場の虫1つと相手のエサ場の虫1つを選び、入れ替える。','ghostSwap','booster4');
  cards[457]=spell(457,'極夜の羽化',0,'自分の場の（幼虫）の虫と、自分の捨て札の同名の成虫を1つずつ選び入れ替える。','polarEvolution','booster4');
  cards[458]=spell(458,'草薙の劫火',5,'自分と相手の場の表向きの虫をすべて破壊し、このターンを終了する。','kusanagiInferno','booster4');
  cards[459]=spell(459,'白蟻の収穫',3,'自分の表向きのエサ場から強化カードを2枚まで選び、手札に戻す。','whiteAntHarvest','booster4');
  cards[460]=spell(460,'葉切蟻の野良仕事',3,'自分の表向きのエサ1枚を手札に戻し、このカードをエサ場に置く。このエサのコストはこのターン発生しない。','leafcutterWork','booster4');
  cards[461]=spell(461,'術弾きの結界',1,'自分の虫1つを選ぶ。次の相手のターン終了時まで、その虫は相手の術カードの対象にならない。','spellShield','booster4');
  cards[462]=spell(462,'剣舞天翔の刹那',2,'自分の虫を2つまでと、自分のエサ場の強化カードを2枚まで選び、それぞれにつける。','swordDanceAttach','booster4');
  cards[463]=spell(463,'伏魔の蟲噛み',1,'相手の虫1つに500ダメージ。同じ名前の別の虫がいれば、さらに1つ選び500ダメージを与えてよい。','sameNameBurn','booster4');
  cards[464]=spell(464,'捨て身の兜投げ',0,'自分の強化カード1枚を破壊する。そうしたなら相手の虫1つに700ダメージを与えてよい。','sacrificeEnhanceBurn','booster4');

  const booster1Ids=Object.values(cards).filter(c=>c.set==='booster1').map(c=>c.id).sort((a,b)=>a-b);
  const booster2Ids=Object.values(cards).filter(c=>c.set==='booster2').map(c=>c.id).sort((a,b)=>a-b);
  const booster3Ids=Object.values(cards).filter(c=>c.set==='booster3').map(c=>c.id).sort((a,b)=>a-b);
  const booster4Ids=Object.values(cards).filter(c=>c.set==='booster4').map(c=>c.id).sort((a,b)=>a-b);
  const decks={
    kabuto:{name:'カブトムシデッキ',ids:[6,6,40,40,44,44,79,79,91,91,24,24,30,30,63,63,108,124,127,129]},
    mantis:{name:'オオカマキリデッキ',ids:[71,71,7,7,11,11,47,47,80,80,22,22,64,64,95,95,106,107,101,118]},
    random1:{name:'ランダム（第1弾）',ids:booster1Ids,randomCount:20},
    random2:{name:'ランダム（第2弾）',ids:booster2Ids,randomCount:20},
    random3:{name:'ランダム（第3弾）',ids:booster3Ids,randomCount:20},
    random4:{name:'ランダム（第4弾）',ids:booster4Ids,randomCount:20}
  };

  return {cards,decks,booster1Ids,booster2Ids,booster3Ids,booster4Ids};
})();